'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function registerMisc(app, { pool, emit }) {

  // ── DB stats & cleanup (used by Settings → DataCleanPanel) ──
  app.get('/api/db/stats', async (_req, res) => {
    try {
      const [msgCount] = await pool.execute('SELECT COUNT(*) AS count FROM chat_messages');
      const [roomCount] = await pool.execute('SELECT COUNT(*) AS count FROM chat_rooms');
      const [logCount] = await pool.execute('SELECT COUNT(*) AS count FROM audit_logs');
      const [userCount] = await pool.execute('SELECT COUNT(*) AS count FROM users');
      const [aiMemCount] = await pool.execute('SELECT COUNT(*) AS count FROM ai_memory').catch(() => [[{ count: 0 }]]);
      res.json({
        success: true,
        stats: {
          chat_messages: msgCount[0].count,
          chat_rooms: roomCount[0].count,
          audit_logs: logCount[0].count,
          users: userCount[0].count,
          ai_memories: aiMemCount[0]?.count || 0,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/db/cleanup', async (req, res) => {
    try {
      const { target } = req.body;
      if (target === 'chat') {
        await pool.execute('TRUNCATE TABLE chat_messages');
        await pool.execute('DELETE FROM chat_participants');
        await pool.execute('DELETE FROM chat_rooms WHERE id > 1');
        emit.safeEmit('odalar-guncellendi');
        emit.safeEmit('veritabani-yenile', { changedTables: ['chat_messages', 'chat_rooms'] });
        res.json({ success: true, message: 'Tüm sohbet geçmişi başarıyla temizlendi.' });
      } else if (target === 'logs') {
        await pool.execute('TRUNCATE TABLE audit_logs');
        emit.safeEmit('veritabani-yenile', { changedTables: ['audit_logs'] });
        res.json({ success: true, message: 'İşlem logları başarıyla temizlendi.' });
      } else if (target === 'ai_memory') {
        await pool.execute('TRUNCATE TABLE ai_memory');
        res.json({ success: true, message: 'Tüm Bitro AI hafızası başarıyla temizlendi.' });
      } else {
        res.status(400).json({ success: false, message: 'Geçersiz temizleme hedefi' });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Dashboard operational summary ──
  app.get('/api/dashboard/stats', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT status, COUNT(*) AS count FROM service_tickets GROUP BY status'
      );
      const statusCount = {};
      let open = 0;
      let waiting = 0;
      const closed = ['Teslim Edildi', 'Tamamlandı', 'Pert', 'İptal'];
      for (const r of rows) {
        statusCount[r.status] = r.count;
        if (closed.includes(r.status)) continue;
        open += r.count;
        if (r.status === 'Parça Bekliyor') waiting += r.count;
      }

      const [todayRows] = await pool.execute(
        'SELECT COUNT(*) AS count FROM service_tickets WHERE DATE(created_at) = CURDATE()'
      );

      const [overdueRows] = await pool.execute(
        `SELECT COUNT(*) AS count FROM service_tickets
         WHERE status NOT IN ('Teslim Edildi','Tamamlandı','Pert','İptal')
           AND created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
      );

      const [tonerCrit] = await pool.execute(
        'SELECT COUNT(*) AS count FROM toner_items WHERE is_active=1 AND qty <= critical_qty'
      );
      const [stockCrit] = await pool.execute(
        'SELECT COUNT(*) AS count FROM stock_items WHERE is_active=1 AND critical_qty > 0 AND qty <= critical_qty'
      );

      res.json({
        success: true,
        stats: {
          today: todayRows[0].count,
          open,
          waiting,
          overdue: overdueRows[0].count,
          critToner: tonerCrit[0].count,
          critStock: stockCrit[0].count,
          byStatus: statusCount,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Backup (web-only; server-side dump to configured folder) ──
  const BACKUP_ROOT = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');

  function ensureBackupRoot() {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }

  async function getTables() {
    const [rows] = await pool.query('SHOW TABLES');
    const key = Object.keys(rows[0] || {})[0];
    return rows.map((r) => r[key]);
  }

  async function dumpDatabase(targetFile) {
    const tables = await getTables();
    let sql = `-- ServiceTracker backup ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\n`;
    for (const table of tables) {
      try {
        const [[{ 'Create Table': createSql }]] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
        sql += `\nDROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n`;
      } catch (e) {
        console.warn(`[backup] SHOW CREATE TABLE failed for ${table}:`, e.message);
      }
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      if (rows.length === 0) continue;
      for (const row of rows) {
        const cols = Object.keys(row).map((k) => '`' + k + '`').join(', ');
        const vals = Object.values(row)
          .map((v) => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return String(v);
            return "'" + String(v).replace(/'/g, "''") + "'";
          })
          .join(', ');
        sql += `INSERT INTO \`${table}\` (${cols}) VALUES (${vals});\n`;
      }
    }
    sql += '\nSET FOREIGN_KEY_CHECKS=1;\n';
    fs.writeFileSync(targetFile, sql, 'utf8');
    return targetFile;
  }

  async function restoreDatabase(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const statements = content
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'));
    for (const stmt of statements) {
      if (!stmt) continue;
      await pool.query(stmt);
    }
  }

  app.get('/api/backup/settings', async (_req, res) => {
    try {
      const [rows] = await pool.execute("SELECT `value` FROM settings WHERE `key` = 'backup_path' LIMIT 1");
      const backupPath = rows[0]?.value || BACKUP_ROOT;
      const [logs] = await pool.execute(
        "SELECT * FROM audit_logs WHERE action='BACKUP' OR action='RESTORE' ORDER BY created_at DESC LIMIT 30"
      );
      res.json({ success: true, backupPath, logs });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/backup/settings', async (req, res) => {
    try {
      const { backupPath } = req.body;
      if (!backupPath) return res.status(400).json({ success: false, message: 'backupPath gereklidir.' });
      await pool.execute(
        'INSERT INTO settings (`key`, `value`, `updated_at`) VALUES (\'backup_path\', ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = CURRENT_TIMESTAMP',
        [String(backupPath)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/backup/files', (_req, res) => {
    try {
      ensureBackupRoot();
      const files = fs
        .readdirSync(BACKUP_ROOT)
        .filter((f) => f.endsWith('.sql'))
        .map((f) => {
          const stat = fs.statSync(path.join(BACKUP_ROOT, f));
          return { name: f, size: stat.size, mtime: stat.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);
      res.json({ success: true, files, dir: BACKUP_ROOT });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/backup/run', async (req, res) => {
    try {
      const { backupPath } = req.body;
      ensureBackupRoot();
      const dir = backupPath && fs.existsSync(backupPath) ? backupPath : BACKUP_ROOT;
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const target = path.join(dir, `backup-${stamp}.sql`);
      const written = await dumpDatabase(target);
      const [logs] = await pool.execute(
        "SELECT * FROM audit_logs WHERE action='BACKUP' ORDER BY created_at DESC LIMIT 30"
      );
      res.json({ success: true, path: written, size: fs.statSync(written).size, logs });
    } catch (err) {
      console.error('[backup/run]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

};
