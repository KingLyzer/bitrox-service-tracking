'use strict';

module.exports = function registerSettings(app, { pool, emit, helpers }) {
  const { dbError } = helpers;

  // All settings as [{key, value}]
  app.get('/api/settings', async (_req, res) => {
    try {
      const [rows] = await pool.execute('SELECT `key`, `value` FROM settings ORDER BY `key` ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'settings:get');
    }
  });

  // Single setting value
  app.get('/api/settings/:key', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT `key`, `value` FROM settings WHERE `key` = ? LIMIT 1', [req.params.key]);
      res.json({ success: true, data: rows[0] || null });
    } catch (err) {
      dbError(res, err, 'settings:get-key');
    }
  });

  // Bulk upsert: { settings: { key: value, ... } }
  app.post('/api/settings/save', async (req, res) => {
    let conn;
    try {
      const settings = req.body.settings || req.body;
      const entries = Object.entries(settings || {}).filter(([, value]) => value !== undefined && value !== null);
      if (entries.length === 0) return res.json({ success: true });

      conn = await pool.getConnection();
      await conn.beginTransaction();

      for (const [key, value] of entries) {
        await conn.execute(
          'INSERT INTO settings (`key`, `value`, `updated_at`) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = CURRENT_TIMESTAMP',
          [key, String(value)]
        );
      }

      await conn.commit();
      emit.safeEmit('veritabani-yenile', { changedTables: ['settings'] });
      res.json({ success: true, saved: entries.length });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[settings/save]', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });
};
