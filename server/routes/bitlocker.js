'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const multer = require('multer');

// Türkçe büyük harf dönüştürücü
function toUpperTr(value) {
  if (!value) return '';
  const map = {
    'i': 'İ', 'ı': 'I', 'ş': 'Ş', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö', 'ç': 'Ç'
  };
  return String(value)
    .replace(/[iışğüöç]/g, ch => map[ch] || ch)
    .toUpperCase()
    .trim();
}

// Dosya adından veya metinden ad soyad, GUID ve kurtarma anahtarını çıkarma
function extractFromFilename(filename) {
  const base = path.parse(filename).name;
  let identifier = null;
  let recovery_key = null;

  const idMatch = base.match(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/);
  if (idMatch) identifier = idMatch[0].toUpperCase();

  const keyMatch = base.match(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/);
  if (keyMatch) recovery_key = keyMatch[0];

  let name = base;
  if (identifier) name = name.replace(identifier, ' ');
  if (recovery_key) name = name.replace(recovery_key, ' ');

  name = name.replace(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/gi, ' ');
  name = name.replace(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/g, ' ');
  name = name.replace(/\b(sifre|sifresi|recovery|bitlocker|kurtarma|anahtar|anahtari|key|pdf|txt|html)\b/gi, ' ');
  name = name.replace(/\d+/g, ' ');
  name = name.replace(/[._-]+/g, ' ');
  name = name.trim().replace(/\s+/g, ' ');

  return { identifier, recovery_key, full_name: name ? toUpperTr(name) : null };
}

function parseBitlockerText(content, filename = null) {
  let text = String(content || '').replace(/\r\n|\r/g, '\n').trim();

  let identifier = null;
  const idMatch = text.match(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/);
  if (idMatch) identifier = idMatch[0].toUpperCase();

  let recovery_key = null;
  const keyMatch = text.match(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/);
  if (keyMatch) recovery_key = keyMatch[0];

  let full_name = null;
  if (filename) {
    const fromFilename = extractFromFilename(filename);
    if (!identifier && fromFilename.identifier) identifier = fromFilename.identifier;
    if (!recovery_key && fromFilename.recovery_key) recovery_key = fromFilename.recovery_key;
    full_name = fromFilename.full_name;
  }

  return { identifier, recovery_key, full_name, raw_text: text };
}

function extractTextFromFile(filePath, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();

  if (ext === '.pdf') {
    try {
      const output = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      return output;
    } catch (e) {
      // pdftotext mevcut değilse veya hata verdiyse binary fallback
      try {
        const raw = fs.readFileSync(filePath, 'binary');
        return raw;
      } catch (err) {
        return '';
      }
    }
  }

  const buf = fs.readFileSync(filePath);
  let content = '';

  // UTF-16 BOM kontrolü
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    content = buf.toString('utf16le');
  } else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    content = buf.swap16().toString('utf16le');
  } else if (buf.includes(0x00)) {
    content = buf.toString('utf16le');
  } else {
    content = buf.toString('utf8');
  }

  if (ext === '.html' || ext === '.htm') {
    content = content.replace(/<[^>]+>/g, ' ');
  }

  return content;
}

module.exports = function registerBitlocker(app, ctx) {
  const { pool, helpers } = ctx;

  // 1. Tablo Kontrolü
  (async () => {
    try {
      if (pool) {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS bitlocker_keys (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            device_name VARCHAR(255) NULL,
            identifier VARCHAR(100) NULL,
            recovery_key VARCHAR(100) NOT NULL,
            source_filename VARCHAR(255) NULL,
            source_file_date DATETIME NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME NULL,
            raw_text LONGTEXT NULL,
            created_by VARCHAR(100) NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_bitlocker_identifier (identifier),
            INDEX idx_bitlocker_fullname (full_name),
            INDEX idx_bitlocker_deleted (deleted_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
      }
    } catch (err) {
      console.error('[bitlocker] Tablo oluşturulamadı:', err.message);
    }
  })();

  const upload = multer({
    dest: path.join(__dirname, '../temp_uploads'),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
  });

  // Ensure temp dir exists
  const tempDir = path.join(__dirname, '../temp_uploads');
  if (!fs.existsSync(tempDir)) {
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch (e) {}
  }

  // ── GET /api/bitlocker/stats ──────────────────────────────
  app.get('/api/bitlocker/stats', async (_req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS trash_count,
          SUM(CASE WHEN deleted_at IS NULL AND uploaded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS recent_count,
          SUM(CASE WHEN deleted_at IS NULL AND device_name IS NOT NULL AND device_name != '' THEN 1 ELSE 0 END) AS device_count
        FROM bitlocker_keys
      `);

      const r = rows[0] || {};
      res.json({
        success: true,
        stats: {
          total: Number(r.total) || 0,
          active: Number(r.active_count) || 0,
          trash: Number(r.trash_count) || 0,
          recent: Number(r.recent_count) || 0,
          devices: Number(r.device_count) || 0
        }
      });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:stats') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── GET /api/bitlocker ────────────────────────────────────
  app.get('/api/bitlocker', async (req, res) => {
    try {
      const { status = 'active', search = '', limit = 1000 } = req.query;

      const whereClauses = [];
      const params = [];

      if (status === 'trash') {
        whereClauses.push('deleted_at IS NOT NULL');
      } else if (status === 'active') {
        whereClauses.push('deleted_at IS NULL');
      }

      if (search && String(search).trim() !== '') {
        const term = `%${String(search).trim()}%`;
        whereClauses.push(`(
          full_name LIKE ? OR 
          device_name LIKE ? OR 
          identifier LIKE ? OR 
          recovery_key LIKE ? OR 
          source_filename LIKE ?
        )`);
        params.push(term, term, term, term, term);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const querySQL = `
        SELECT id, full_name, device_name, identifier, recovery_key, 
               source_filename, source_file_date, uploaded_at, deleted_at, raw_text, created_by
        FROM bitlocker_keys
        ${whereSQL}
        ORDER BY ${status === 'trash' ? 'deleted_at DESC' : 'uploaded_at DESC, id DESC'}
        LIMIT ?
      `;
      params.push(Number(limit) || 1000);

      const [rows] = await pool.query(querySQL, params);

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:list') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── POST /api/bitlocker ───────────────────────────────────
  app.post('/api/bitlocker', async (req, res) => {
    try {
      const { full_name, device_name, identifier, recovery_key, raw_text, created_by } = req.body;

      if (!full_name || !String(full_name).trim()) {
        return res.status(400).json({ success: false, message: 'Ad Soyad alanı zorunludur.' });
      }

      if (!recovery_key || !String(recovery_key).trim()) {
        return res.status(400).json({ success: false, message: 'BitLocker Kurtarma Anahtarı zorunludur.' });
      }

      const cleanKey = String(recovery_key).trim();
      const cleanId = identifier ? String(identifier).trim().toUpperCase() : null;
      const cleanName = toUpperTr(full_name);
      const cleanDev = device_name ? toUpperTr(device_name) : null;

      // Duplicate kontrolü
      const [exist] = await pool.execute(
        'SELECT id FROM bitlocker_keys WHERE recovery_key = ? AND deleted_at IS NULL LIMIT 1',
        [cleanKey]
      );
      if (exist.length > 0) {
        return res.status(400).json({ success: false, message: 'Bu kurtarma anahtarı veritabanında zaten kayıtlı.' });
      }

      const [insertRes] = await pool.execute(
        `INSERT INTO bitlocker_keys 
         (full_name, device_name, identifier, recovery_key, raw_text, created_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [cleanName, cleanDev, cleanId, cleanKey, raw_text || null, created_by || 'Sistem']
      );

      res.json({ success: true, id: insertRes.insertId, message: 'BitLocker anahtarı başarıyla kaydedildi.' });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:create') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── PUT /api/bitlocker/:id ────────────────────────────────
  app.put('/api/bitlocker/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID' });

      const { full_name, device_name, identifier, recovery_key, raw_text } = req.body;

      if (!full_name || !String(full_name).trim()) {
        return res.status(400).json({ success: false, message: 'Ad Soyad zorunludur.' });
      }
      if (!recovery_key || !String(recovery_key).trim()) {
        return res.status(400).json({ success: false, message: 'Kurtarma Anahtarı zorunludur.' });
      }

      const cleanKey = String(recovery_key).trim();
      const cleanId = identifier ? String(identifier).trim().toUpperCase() : null;
      const cleanName = toUpperTr(full_name);
      const cleanDev = device_name ? toUpperTr(device_name) : null;

      await pool.execute(
        `UPDATE bitlocker_keys 
         SET full_name = ?, device_name = ?, identifier = ?, recovery_key = ?, raw_text = ?
         WHERE id = ?`,
        [cleanName, cleanDev, cleanId, cleanKey, raw_text || null, id]
      );

      res.json({ success: true, message: 'BitLocker kaydı güncellendi.' });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:update') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── DELETE /api/bitlocker/:id (Çöp kutusuna taşı) ─────────
  app.delete('/api/bitlocker/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID' });

      await pool.execute('UPDATE bitlocker_keys SET deleted_at = NOW() WHERE id = ?', [id]);
      res.json({ success: true, message: 'Kayıt çöp kutusuna taşındı.' });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:delete') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── POST /api/bitlocker/:id/restore (Geri al) ─────────────
  app.post('/api/bitlocker/:id/restore', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID' });

      await pool.execute('UPDATE bitlocker_keys SET deleted_at = NULL WHERE id = ?', [id]);
      res.json({ success: true, message: 'Kayıt çöp kutusundan geri yüklendi.' });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:restore') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── DELETE /api/bitlocker/:id/permanent (Kalıcı sil) ──────
  app.delete('/api/bitlocker/:id/permanent', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID' });

      await pool.execute('DELETE FROM bitlocker_keys WHERE id = ?', [id]);
      res.json({ success: true, message: 'Kayıt kalıcı olarak silindi.' });
    } catch (err) {
      helpers?.dbError ? helpers.dbError(res, err, 'bitlocker:permanent') : res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── POST /api/bitlocker/upload (Toplu dosya yükleme & parse) ─
  app.post('/api/bitlocker/upload', upload.array('files', 100), async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Lütfen en az bir dosya seçin.' });
    }

    const { default_full_name, created_by } = req.body;
    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const addedItems = [];

    for (const file of files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      try {
        const text = extractTextFromFile(file.path, originalName);
        const parsed = parseBitlockerText(text, originalName);

        const fullName = default_full_name ? toUpperTr(default_full_name) : (parsed.full_name || 'BİLİNMİYOR');
        const recoveryKey = parsed.recovery_key;
        const identifier = parsed.identifier;

        if (!recoveryKey) {
          errors.push(`${originalName}: Kurtarma anahtarı tespit edilemedi.`);
          continue;
        }

        // Check duplicate
        const [existing] = await pool.execute(
          'SELECT id FROM bitlocker_keys WHERE recovery_key = ? AND deleted_at IS NULL LIMIT 1',
          [recoveryKey]
        );

        if (existing.length > 0) {
          skippedCount++;
          continue;
        }

        const [insRes] = await pool.execute(
          `INSERT INTO bitlocker_keys 
           (full_name, identifier, recovery_key, source_filename, raw_text, created_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [fullName, identifier, recoveryKey, originalName, parsed.raw_text, created_by || 'Dosya Yükleme']
        );

        addedCount++;
        addedItems.push({ id: insRes.insertId, full_name: fullName, recovery_key: recoveryKey });
      } catch (err) {
        errors.push(`${originalName}: ${err.message}`);
      } finally {
        // Temp dosyayı sil
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }

    res.json({
      success: true,
      total_files: files.length,
      added: addedCount,
      skipped: skippedCount,
      errors,
      added_items: addedItems,
      message: `${addedCount} anahtar başarıyla eklendi, ${skippedCount} mevcut anahtar atlandı.`
    });
  });
};
