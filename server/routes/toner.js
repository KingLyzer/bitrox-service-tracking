'use strict';

module.exports = function registerToner(app, { pool, emit, helpers }) {
  const { cleanText, dbError } = helpers;

  function notify(tables) {
    emit.safeEmit('veritabani-yenile', { changedTables: tables });
  }

  // Consumable categories used by Snipe-IT (sarf / consum)
  app.get('/api/toner/refs/categories', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM cached_categories WHERE LOWER(category_type) LIKE '%sarf%' OR LOWER(category_type) LIKE '%consum%' ORDER BY name ASC"
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'toner:ref-categories');
    }
  });

  app.get('/api/toner/items', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM toner_items WHERE is_active=1 ORDER BY toner_model');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'toner:items');
    }
  });

  app.get('/api/toner/items/:id', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM toner_items WHERE id = ?', [req.params.id]);
      res.json({ success: true, data: rows[0] || null });
    } catch (err) {
      dbError(res, err, 'toner:item-get');
    }
  });

  app.get('/api/toner/changes', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT tc.*,
            ti.toner_model,
            COALESCE(tc.assigned_user_name, cu.name, tc.asset_name, '—') AS target_name
         FROM toner_changes tc
         LEFT JOIN toner_items ti ON tc.toner_id = ti.id
         LEFT JOIN cached_users cu ON tc.assigned_user_id = cu.id
         ORDER BY tc.change_date DESC, tc.id DESC
         LIMIT 500`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'toner:changes');
    }
  });

  app.post('/api/toner/items/delete', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'id gereklidir.' });
      const [result] = await pool.execute('UPDATE toner_items SET is_active=0 WHERE id=?', [id]);
      notify(['toner_items']);
      res.json({ success: result.affectedRows > 0 });
    } catch (err) {
      dbError(res, err, 'toner:item-delete');
    }
  });

  app.post('/api/toner/changes/delete', async (req, res) => {
    let conn;
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'id gereklidir.' });
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [rows] = await conn.execute('SELECT * FROM toner_changes WHERE id = ?', [id]);
      const change = rows[0];
      if (!change) return res.json({ success: false, message: 'Çıkış kaydı bulunamadı.' });
      const qty = Number(change.qty || 1);
      await conn.execute(
        'UPDATE toner_items SET qty = qty + ?, available_qty = COALESCE(available_qty, 0) + ? WHERE id=?',
        [qty, qty, change.toner_id]
      );
      await conn.execute('DELETE FROM toner_changes WHERE id=?', [id]);
      await conn.commit();
      notify(['toner_items', 'toner_changes']);
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'toner:change-delete');
    } finally {
      if (conn) conn.release();
    }
  });

  // Create a toner checkout: decrement stock + insert change, atomically.
  app.post('/api/toner/change', async (req, res) => {
    let conn;
    try {
      const { toner_id, change_date, user_id, assigned_user_id, assigned_user_name, qty, notes } = req.body;
      if (!toner_id || !assigned_user_id) {
        return res.status(400).json({ success: false, message: 'Kullanıcı ve sarf malzemesi zorunludur.' });
      }
      const numericQty = Number(qty);
      if (!Number.isFinite(numericQty) || numericQty <= 0) {
        return res.status(400).json({ success: false, message: 'Geçerli bir adet giriniz.' });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [tonerRows] = await conn.execute('SELECT * FROM toner_items WHERE id = ?', [toner_id]);
      const toner = tonerRows[0];
      if (!toner || !toner.is_active) return res.json({ success: false, message: 'Sarf malzemesi bulunamadı.' });
      if (Number(toner.qty || 0) < numericQty) {
        return res.json({ success: false, message: 'Seçilen sarf malzemesinde yeterli stok yok.' });
      }

      const [stockRes] = await conn.execute(
        `UPDATE toner_items SET qty = qty - ?, available_qty = CASE WHEN COALESCE(available_qty, qty) - ? < 0 THEN 0 ELSE COALESCE(available_qty, qty) - ? END WHERE id=? AND qty >= ?`,
        [numericQty, numericQty, numericQty, toner_id, numericQty]
      );
      if (stockRes.affectedRows === 0) {
        return res.json({ success: false, message: 'Sarf malzemesi stok güncellemesi yapılamadı.' });
      }

      const [insertRes] = await conn.execute(
        `INSERT INTO toner_changes (asset_id, asset_name, toner_id, change_date, user_id, assigned_user_id, assigned_user_name, page_count, qty, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [null, null, toner_id, change_date || null, user_id || null, assigned_user_id, assigned_user_name || null, null, numericQty, cleanText(notes)]
      );

      await conn.commit();
      notify(['toner_items', 'toner_changes']);
      res.json({ success: true, lastInsertRowid: insertRes.insertId });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[toner:change]', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });
};
