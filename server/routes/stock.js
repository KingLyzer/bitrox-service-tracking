'use strict';

module.exports = function registerStock(app, { pool, emit, helpers }) {
  const { cleanText, tableHasColumn, dbError } = helpers;

  function notify(tables) {
    emit.safeEmit('veritabani-yenile', { changedTables: tables });
  }

  // ── Schema bootstrap (idempotent) ──
  app.post('/api/stock/ensure-schema', async (_req, res) => {
    try {
      const results = {};
      if (!(await tableHasColumn(pool, 'stock_items', 'barcode'))) {
        await pool.execute('ALTER TABLE stock_items ADD COLUMN barcode VARCHAR(128) DEFAULT NULL');
        results.barcode = 'added';
      } else {
        results.barcode = 'exists';
      }
      if (!(await tableHasColumn(pool, 'stock_items', 'stock_type'))) {
        await pool.execute("ALTER TABLE stock_items ADD COLUMN stock_type VARCHAR(32) NOT NULL DEFAULT 'office'");
        results.stock_type = 'added';
      } else {
        results.stock_type = 'exists';
      }
      if (!(await tableHasColumn(pool, 'stock_movements', 'receiver'))) {
        await pool.execute('ALTER TABLE stock_movements ADD COLUMN receiver VARCHAR(255) DEFAULT NULL');
        results.receiver = 'added';
      } else {
        results.receiver = 'exists';
      }
      // Ensure AUTO_INCREMENT on id columns so inserts with qty > 0 never fail with "Field 'id' doesn't have a default value"
      try {
        await pool.execute('ALTER TABLE stock_movements MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT');
        await pool.execute('ALTER TABLE stock_movements MODIFY COLUMN move_date DATETIME DEFAULT CURRENT_TIMESTAMP');
        results.stock_movements_ai = 'ok';
      } catch (e) {
        results.stock_movements_ai = e.message;
      }
      try {
        await pool.execute('ALTER TABLE used_parts MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT');
      } catch (e) {}
      try {
        await pool.execute('ALTER TABLE attachments MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT');
      } catch (e) {}
      res.json({ success: true, ...results });
    } catch (err) {
      dbError(res, err, 'stock:ensure-schema');
    }
  });

  // ── Helper to normalize stock type ──
  function normalizeStockType(type) {
    const raw = String(type || '').trim().toLowerCase();
    if (raw === 'scrap' || raw === 'hurda' || raw === 'screen' || raw === 'ekran') return 'scrap';
    return 'office';
  }

  // ── Items ──
  app.get('/api/stock/items', async (req, res) => {
    try {
      if (req.query.compact === '1' || req.query.compact === 'true') {
        const [rows] = await pool.query('SELECT qty, critical_qty, is_active, stock_type FROM stock_items');
        return res.json({ success: true, data: rows });
      }
      const [rows] = await pool.query(
        `SELECT si.*, COALESCE(si.category_name, sc.name) AS category_name
         FROM stock_items si
         LEFT JOIN stock_categories sc ON si.category_id = sc.id
         WHERE si.is_active = 1
         ORDER BY si.name`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'stock:items');
    }
  });

  app.get('/api/stock/items/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Geçersiz id.' });
      const [rows] = await pool.execute('SELECT * FROM stock_items WHERE id = ?', [id]);
      res.json({ success: true, data: rows[0] || null });
    } catch (err) {
      dbError(res, err, 'stock:item-get');
    }
  });

  app.post('/api/stock/items', async (req, res) => {
    let conn;
    try {
      const { stock_code, name, barcode, category_id, unit, qty, critical_qty, unit_price, location, description, user_id, stock_type } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Ürün adı zorunludur.' });
      }
      const numericQty = Math.max(0, Number(qty) || 0);
      const sanitizedStockType = normalizeStockType(stock_type);

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [result] = await conn.execute(
        `INSERT INTO stock_items
          (stock_code, name, barcode, category_id, unit, qty, critical_qty, unit_price, location, description, stock_type, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          String(stock_code || '').trim() || String(Date.now()),
          String(name).trim(),
          String(barcode || '').trim() || String(stock_code || '').trim() || null,
          category_id || null,
          unit || 'Adet',
          numericQty,
          Math.max(0, Number(critical_qty) || 0),
          Math.max(0, Number(unit_price) || 0),
          cleanText(location),
          cleanText(description),
          sanitizedStockType,
        ]
      );

      if (numericQty > 0) {
        await conn.execute(
          `INSERT INTO stock_movements (stock_id, move_type, qty, user_id, notes, move_date) VALUES (?, 'Giriş', ?, ?, 'Başlangıç stoğu', NOW())`,
          [result.insertId, numericQty, user_id || null]
        );
      }

      await conn.commit();
      notify(['stock_items', 'stock_movements']);
      res.json({ success: true, insertId: result.insertId });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[stock:create]', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.put('/api/stock/items/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Geçersiz id.' });

      const { name, barcode, category_id, unit, critical_qty, unit_price, location, description, stock_type } = req.body;
      const sanitizedStockType = normalizeStockType(stock_type);

      await pool.execute(
        `UPDATE stock_items
         SET name=?, barcode=?, category_id=?, unit=?, critical_qty=?, unit_price=?, location=?, description=?, stock_type=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [
          String(name || '').trim(),
          String(barcode || '').trim() || null,
          category_id || null,
          unit || 'Adet',
          Math.max(0, Number(critical_qty) || 0),
          Math.max(0, Number(unit_price) || 0),
          cleanText(location),
          cleanText(description),
          sanitizedStockType,
          id,
        ]
      );
      notify(['stock_items']);
      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'stock:update');
    }
  });

  app.post('/api/stock/items/delete', async (req, res) => {
    let conn;
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'id gereklidir.' });
      conn = await pool.getConnection();
      await conn.beginTransaction();
      await conn.execute('DELETE FROM stock_movements WHERE stock_id = ?', [id]);
      const [result] = await conn.execute('DELETE FROM stock_items WHERE id = ?', [id]);
      await conn.commit();
      if (result.affectedRows === 0) {
        return res.json({ success: false, message: 'Stok kalemi bulunamadı.' });
      }
      notify(['stock_items', 'stock_movements']);
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'stock:delete');
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/stock/items/delete-many', async (req, res) => {
    let conn;
    try {
      const ids = (req.body.ids || []).map(Number).filter(Number.isFinite);
      if (ids.length === 0) return res.status(400).json({ success: false, message: 'ids gereklidir.' });
      const placeholders = ids.map(() => '?').join(',');
      conn = await pool.getConnection();
      await conn.beginTransaction();
      await conn.execute(`DELETE FROM stock_movements WHERE stock_id IN (${placeholders})`, ids);
      const [result] = await conn.execute(`DELETE FROM stock_items WHERE id IN (${placeholders})`, ids);
      await conn.commit();
      notify(['stock_items', 'stock_movements']);
      res.json({ success: true, deleted: result.affectedRows });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'stock:delete-many');
    } finally {
      if (conn) conn.release();
    }
  });

  // ── Adjustments / checkout ──
  app.post('/api/stock/adjust', async (req, res) => {
    let conn;
    try {
      const { id, type, qty, note, user_id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'id gereklidir.' });
      const numericQty = Number(qty);
      if (!Number.isFinite(numericQty) || numericQty <= 0) {
        return res.status(400).json({ success: false, message: 'Geçerli bir miktar girin.' });
      }

      const typeLabel = type === 'add' ? 'Giriş' : type === 'sub' ? 'Çıkış' : 'Düzeltme';

      conn = await pool.getConnection();
      await conn.beginTransaction();

      if (type === 'sub') {
        const [rows] = await conn.execute('SELECT qty FROM stock_items WHERE id = ?', [id]);
        if (rows.length === 0) return res.json({ success: false, message: 'Stok kalemi bulunamadı.' });
        if (numericQty > Number(rows[0].qty || 0)) {
          return res.json({ success: false, message: `Yetersiz stok! Mevcut: ${rows[0].qty}` });
        }
        await conn.execute(
          'UPDATE stock_items SET qty = qty - ?, available_qty = COALESCE(available_qty, qty) - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [numericQty, numericQty, id]
        );
      } else if (type === 'add') {
        await conn.execute(
          'UPDATE stock_items SET qty = qty + ?, available_qty = COALESCE(available_qty, qty) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [numericQty, numericQty, id]
        );
      } else {
        await conn.execute(
          'UPDATE stock_items SET qty = ?, available_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [numericQty, numericQty, id]
        );
      }

      await conn.execute(
        `INSERT INTO stock_movements (stock_id, move_type, qty, ref_type, user_id, notes, move_date) VALUES (?, ?, ?, 'manual', ?, ?, NOW())`,
        [id, typeLabel, numericQty, user_id || null, cleanText(note)]
      );

      await conn.commit();
      notify(['stock_items', 'stock_movements']);
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[stock:adjust]', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/stock/checkout', async (req, res) => {
    let conn;
    try {
      const { id, qty, receiver, user_id, note } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'id gereklidir.' });
      const numericQty = Number(qty);
      if (!Number.isFinite(numericQty) || numericQty <= 0) {
        return res.status(400).json({ success: false, message: 'Geçerli bir miktar girin.' });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT qty FROM stock_items WHERE id = ?', [id]);
      if (rows.length === 0) return res.json({ success: false, message: 'Stok kalemi bulunamadı.' });
      if (numericQty > Number(rows[0].qty || 0)) {
        return res.json({ success: false, message: `Yetersiz stok! Mevcut: ${rows[0].qty}` });
      }

      await conn.execute(
        'UPDATE stock_items SET qty = qty - ?, available_qty = COALESCE(available_qty, qty) - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [numericQty, numericQty, id]
      );
      await conn.execute(
        `INSERT INTO stock_movements (stock_id, move_type, qty, ref_type, receiver, user_id, notes, move_date) VALUES (?, 'Çıkış', ?, 'checkout', ?, ?, ?, NOW())`,
        [id, numericQty, cleanText(receiver), user_id || null, cleanText(note)]
      );

      await conn.commit();
      notify(['stock_items', 'stock_movements']);
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[stock:checkout]', err.message);
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.get('/api/stock/movements', async (req, res) => {
    try {
      const stockId = req.query.stock_id;
      if (!stockId) return res.status(400).json({ success: false, message: 'stock_id gerekli.' });
      const [rows] = await pool.execute(
        `SELECT sm.*, COALESCE(u.full_name, u.username) AS user_name
         FROM stock_movements sm
         LEFT JOIN users u ON sm.user_id = u.id
         WHERE sm.stock_id = ?
         ORDER BY sm.id DESC
         LIMIT 300`,
        [stockId]
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'stock:movements');
    }
  });

  // ── Categories ──
  app.get('/api/stock/categories', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT id, name FROM stock_categories WHERE is_active = 1 ORDER BY name');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'stock:categories');
    }
  });

  app.get('/api/stock/categories/full', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT sc.*, COUNT(si.id) AS item_count
         FROM stock_categories sc
         LEFT JOIN stock_items si ON sc.id = si.category_id AND si.is_active = 1
         WHERE sc.is_active = 1
         GROUP BY sc.id
         ORDER BY sc.name ASC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'stock:categories-full');
    }
  });

  app.post('/api/stock/categories', async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'Kategori adı zorunludur.' });
      const [result] = await pool.execute(
        'INSERT INTO stock_categories (name, description, is_active) VALUES (?, ?, 1)',
        [String(name).trim(), cleanText(description)]
      );
      notify(['stock_categories']);
      res.json({ success: true, insertId: result.insertId });
    } catch (err) {
      dbError(res, err, 'stock:category-create');
    }
  });

  app.put('/api/stock/categories/:id', async (req, res) => {
    try {
      const { name, description } = req.body;
      await pool.execute(
        'UPDATE stock_categories SET name = ?, description = ? WHERE id = ?',
        [String(name || '').trim(), cleanText(description), req.params.id]
      );
      notify(['stock_categories']);
      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'stock:category-update');
    }
  });

  app.post('/api/stock/categories/delete', async (req, res) => {
    try {
      const { id } = req.body;
      await pool.execute('UPDATE stock_categories SET is_active = 0 WHERE id = ?', [id]);
      notify(['stock_categories']);
      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'stock:category-delete');
    }
  });

  // ── Reports ──
  app.get('/api/stock/reports/critical', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT si.name AS 'Parça Adı', sc.name AS 'Kategori', si.qty AS 'Mevcut', si.critical_qty AS 'Kritik Seviye', si.unit AS 'Birim', si.location AS 'Konum' FROM stock_items si LEFT JOIN stock_categories sc ON si.category_id=sc.id WHERE si.qty <= si.critical_qty AND si.is_active=1 ORDER BY si.qty ASC"
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'stock:report-critical');
    }
  });
};
