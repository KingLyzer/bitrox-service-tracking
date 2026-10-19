'use strict';

module.exports = function registerDb(app, { pool, emit, helpers }) {
  const { detectTableChanges, dbError } = helpers;

  function normalizeSql(rawSql) {
    if (!rawSql || typeof rawSql !== 'string') return rawSql;
    let sql = rawSql;
    if (/INSERT\s+OR\s+REPLACE/i.test(sql)) {
      sql = sql.replace(/INSERT\s+OR\s+REPLACE/i, 'REPLACE');
    }
    sql = sql.replace(/\bSELECT\s+key\s*,\s*value\s+FROM\b/i, 'SELECT `key`, `value` FROM');
    sql = sql.replace(/\bsettings\s*\(\s*key\s*,\s*value\b/i, 'settings (`key`, `value`');
    sql = sql.replace(/\bsettings\s*\(\s*key\s*,\s*value\s*,\s*updated_at\b/i, 'settings (`key`, `value`, `updated_at`');
    return sql;
  }

  // ── Raw query: returns array of rows ──
  app.post('/api/db/query', async (req, res) => {
    try {
      const { sql, params } = req.body;
      if (!sql) return res.status(400).json({ success: false, message: 'sql gereklidir.' });
      const [rows] = await pool.execute(normalizeSql(sql), params || []);
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'db:query');
    }
  });

  // ── Single row get ──
  app.post('/api/db/get', async (req, res) => {
    try {
      const { sql, params } = req.body;
      if (!sql) return res.status(400).json({ success: false, message: 'sql gereklidir.' });
      const [rows] = await pool.execute(normalizeSql(sql), params || []);
      res.json({ success: true, data: rows[0] || null });
    } catch (err) {
      dbError(res, err, 'db:get');
    }
  });

  // ── Run (INSERT/UPDATE/DELETE) ──
  app.post('/api/db/run', async (req, res) => {
    try {
      const { sql, params } = req.body;
      if (!sql) return res.status(400).json({ success: false, message: 'sql gereklidir.' });
      const nSql = normalizeSql(sql);
      const [result] = await pool.execute(nSql, params || []);

      // Broadcast table changes if applicable
      const changedTables = detectTableChanges(nSql);
      if (changedTables.length > 0) {
        emit.safeEmit('veritabani-yenile', { changedTables });
      }

      res.json({
        success: true,
        insertId: result.insertId || null,
        lastInsertRowid: result.insertId || null,
        changes: result.affectedRows || 0,
        affectedRows: result.affectedRows || 0,
      });
    } catch (err) {
      dbError(res, err, 'db:run');
    }
  });

  // ── Transaction: array of { sql, params } ──
  app.post('/api/db/transaction', async (req, res) => {
    let conn;
    try {
      const { operations } = req.body;
      if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ success: false, message: 'operations dizisi gereklidir.' });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const allChangedTables = new Set();
      for (const op of operations) {
        const nSql = normalizeSql(op.sql);
        await conn.execute(nSql, op.params || []);
        detectTableChanges(nSql).forEach(t => allChangedTables.add(t));
      }

      await conn.commit();

      if (allChangedTables.size > 0) {
        emit.safeEmit('veritabani-yenile', { changedTables: Array.from(allChangedTables) });
      }

      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[db:transaction]', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  // ── MySQL connection test (used by Settings panel) ──
  app.post('/api/db/test-mysql', async (_req, res) => {
    try {
      await pool.execute('SELECT 1');
      res.json({ success: true, message: 'MySQL bağlantısı başarılı.' });
    } catch (err) {
      res.json({ success: false, message: 'Bağlantı hatası: ' + err.message });
    }
  });

  // ── Stubs for SQLite sync operations (not needed in web-only mode) ──
  app.post('/api/db/pull-mysql-settings', (_req, res) => {
    res.json({ success: true, pulled: 0, message: 'Web modunda zaten MySQL kullanılıyor.' });
  });

  app.post('/api/db/pull-mysql', (_req, res) => {
    res.json({ success: true, message: 'Web modunda zaten MySQL kullanılıyor.', changedTables: [] });
  });

  app.post('/api/db/push-mysql', (_req, res) => {
    res.json({ success: true, message: 'Web modunda zaten MySQL kullanılıyor.' });
  });

  app.post('/api/db/mysql-sync-state', (_req, res) => {
    res.json({ success: false, message: 'Web modunda senkronizasyon gerekli değil.' });
  });

  app.post('/api/db/flush-mysql-pending', (_req, res) => {
    res.json({ success: true });
  });
};
