'use strict';

module.exports = function registerService(app, { pool, helpers, emit, webpush }) {
  const {
    nowSql,
    cleanText,
    normalizeTicket,
    generateTicketNo,
    dbError,
  } = helpers;

  async function buildTicketsList() {
    const [ticketsResult, operationsResult, partsResult] = await Promise.all([
      pool.query(`
        SELECT *
        FROM service_tickets
        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
      `),
      pool.query(`
        SELECT op.*, u.full_name AS tech_name, u.username AS tech_username
        FROM service_operations op
        LEFT JOIN users u ON op.user_id = u.id
        ORDER BY COALESCE(op.op_date, op.created_at) DESC, op.id DESC
      `).catch(() => [[]]),
      pool.query(`
        SELECT * FROM used_parts ORDER BY id DESC
      `).catch(() => [[]])
    ]);

    const tickets = ticketsResult[0];
    const operations = operationsResult[0];
    const parts = partsResult[0];

    const operationsByTicket = new Map();
    for (const op of operations || []) {
      const key = String(op.ticket_id);
      if (!operationsByTicket.has(key)) operationsByTicket.set(key, []);
      operationsByTicket.get(key).push({
        ...op,
        action_type: op.action_type || op.op_type,
        islem: op.islem || op.op_type,
        teknisyen: op.teknisyen || op.tech_name || 'Bilinmeyen Teknisyen',
      });
    }

    const partsByTicket = new Map();
    for (const part of parts || []) {
      const key = String(part.ticket_id);
      if (!partsByTicket.has(key)) partsByTicket.set(key, []);
      partsByTicket.get(key).push({
        ...part,
        parca: part.parca || part.part_name,
        miktar: part.miktar || part.qty,
        tutar: part.tutar || part.total_price,
      });
    }

    return tickets.map(ticket => normalizeTicket({
      ...ticket,
      service_operations: operationsByTicket.get(String(ticket.id)) || [],
      used_parts: partsByTicket.get(String(ticket.id)) || [],
    }));
  }

  // ── Ticket list (raw array, legacy fetch-based callers) ──
  app.get('/api/fisler', async (_req, res) => {
    try {
      res.json(await buildTicketsList());
    } catch (err) {
      console.error('[fisler]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ── Ticket list (wrapped, used by the web API layer) ──
  app.all('/api/service/tickets', async (_req, res) => {
    try {
      res.json({ success: true, data: await buildTicketsList() });
    } catch (err) {
      console.error('[service/tickets]', err);
      dbError(res, err, 'service/tickets');
    }
  });

  // Alias kept for the web shim (window.electronAPI.getServiceTickets).
  app.post('/api/service/get-tickets', async (_req, res) => {
    try {
      res.json({ success: true, data: await buildTicketsList() });
    } catch (err) {
      console.error('[service/get-tickets]', err);
      dbError(res, err, 'service/get-tickets');
    }
  });

  // ── New ticket number (direct implementation, no route-rewrite hack) ──
  app.get('/api/yeni-fis-no', async (_req, res) => {
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const ticket_no = await generateTicketNo(conn);
      await conn.commit();
      res.json({ success: true, ticket_no });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      res.status(500).json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/util/generate-ticket-no', async (_req, res) => {
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const ticket_no = await generateTicketNo(conn);
      await conn.commit();
      res.json({ success: true, ticket_no });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      res.status(500).json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/util/generate-code', async (req, res) => {
    try {
      const { type } = req.body;
      const keyMap = { device: 'device_prefix', stock: 'stock_prefix', toner: 'toner_prefix' };
      const tableMap = { device: 'devices', stock: 'stock_items', toner: 'toner_items' };
      const colMap = { device: 'device_code', stock: 'stock_code', toner: 'toner_code' };

      if (!keyMap[type] || !tableMap[type] || !colMap[type]) {
        return res.json({ success: false, message: 'Geçersiz kod türü.' });
      }

      const [setRows] = await pool.execute('SELECT value FROM settings WHERE `key` = ? LIMIT 1', [keyMap[type]]);
      const prefix = setRows.length > 0 ? setRows[0].value : type.toUpperCase().slice(0, 3);

      const col = colMap[type];
      const table = tableMap[type];

      const [lastRows] = await pool.execute(`SELECT ${col} FROM ${table} ORDER BY id DESC LIMIT 1`);

      let seq = 1;
      if (lastRows.length > 0 && lastRows[0][col]) {
        const parts = lastRows[0][col].split('-');
        const parsed = parseInt(parts[parts.length - 1], 10);
        seq = Number.isFinite(parsed) ? parsed + 1 : 1;
      }
      res.json({ success: true, value: `${prefix}-${String(seq).padStart(4, '0')}` });
    } catch (err) {
      res.json({ success: false, message: err.message });
    }
  });

  app.post('/api/fis-ekle', async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const {
        model_name,
        asset_name,
        location_name,
        serial_no,
        asset_tag,
        fault_desc,
        notes,
        priority = 'Normal',
        status = 'Yeni Kayıt',
        delivery_date = null,
        user_name,
        delivered_to,
        teslim_eden,
        teknisyen,
        mac_address,
        record_type = 'service',
        template_id,
        os_name,
        os_license,
      } = req.body;

      const created_at = nowSql();

      await conn.beginTransaction();
      const finalTicketNo = await generateTicketNo(conn);

      const finalModelName = model_name || asset_name || asset_tag || 'Bilinmeyen Cihaz';
      const deliveredTo = user_name || delivered_to || teslim_eden || null;

      const [result] = await conn.execute(
        `INSERT INTO service_tickets
          (ticket_no, created_at, updated_at, asset_tag, serial_no, model_name, asset_name,
           location_name, fault_desc, priority, status, notes, delivery_date, user_name, teknisyen, record_type, mac_address, os_name, os_license)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalTicketNo,
          created_at,
          created_at,
          cleanText(asset_tag),
          cleanText(serial_no),
          cleanText(finalModelName),
          cleanText(asset_name),
          cleanText(location_name),
          cleanText(fault_desc) || 'Arıza açıklaması yok.',
          priority,
          status,
          cleanText(notes),
          delivery_date || null,
          cleanText(deliveredTo),
          cleanText(teknisyen) || 'Bilinmeyen Teknisyen',
          record_type,
          cleanText(mac_address) || null,
          cleanText(os_name) || null,
          cleanText(os_license) || null,
        ]
      );

      if ((record_type === 'installation' || record_type === 'standalone_task') && template_id) {
        const [templateTasks] = await conn.execute(
          'SELECT task_name, input_type, is_required FROM installation_template_tasks WHERE template_id = ? ORDER BY sort_order ASC',
          [template_id]
        );
        if (templateTasks.length > 0) {
          for (const task of templateTasks) {
            await conn.execute(
              'INSERT INTO installation_tasks (ticket_id, task_name, input_type, is_required) VALUES (?, ?, ?, ?)',
              [result.insertId, task.task_name, task.input_type || 'checkbox', task.is_required || 0]
            );
          }
        }
      }

      await conn.commit();
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Yeni servis fişi eklendi.', insertId: result.insertId });

      webpush.sendWebPushNotification({
        title: `Yeni Servis Kaydı 🛠️ (${finalTicketNo})`,
        body: `${deliveredTo || 'Kullanıcı'} - ${asset_name || finalModelName || 'Cihaz'}: ${fault_desc || 'Yeni servis kaydı açıldı.'}`,
        url: '/',
        tag: 'ticket-' + result.insertId
      }).catch(() => {});

      res.json({ success: true, id: result.insertId, insertId: result.insertId, ticket_no: finalTicketNo });
    } catch (err) {
      await conn.rollback().catch(() => {});
      console.error('[fis-ekle]', err);
      res.status(500).json({ success: false, message: err.message });
    } finally {
      conn.release();
    }
  });

  app.post('/api/islem-ekle', async (req, res) => {
    try {
      const { ticket_id, user_id, action_type, op_type, status_change, description } = req.body;
      if (!ticket_id) return res.status(400).json({ success: false, message: 'ticket_id gereklidir.' });

      const currentTime = nowSql();
      const finalType = action_type || op_type || 'Genel Bakım';
      const finalStatus = status_change && status_change !== '-- Değiştirme --' ? status_change : null;

      const [result] = await pool.execute(
        `INSERT INTO service_operations
          (ticket_id, user_id, op_date, op_type, description, status_change, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ticket_id,
          user_id || null,
          currentTime,
          finalType,
          cleanText(description) || 'Açıklama yok.',
          finalStatus,
          currentTime,
        ]
      );

      if (finalStatus) {
        await pool.execute(
          'UPDATE service_tickets SET status = ?, updated_at = ? WHERE id = ?',
          [finalStatus, currentTime, ticket_id]
        );
      }

      emit.safeEmit('veriler-guncellendi', { mesaj: 'Servis işlemi eklendi.', ticket_id });
      res.json({ success: true, id: result.insertId });
    } catch (err) {
      console.error('[islem-ekle]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/parca-ekle', async (req, res) => {
    let conn;
    try {
      const { ticket_id, part_name, qty = 1, unit_price = 0 } = req.body;
      if (!ticket_id || !part_name) {
        return res.status(400).json({ success: false, message: 'ticket_id ve part_name gereklidir.' });
      }

      const numericQty = Number(qty) || 1;
      const numericUnitPrice = Number(unit_price) || 0;
      const totalPrice = Number(req.body.total_price ?? numericQty * numericUnitPrice);
      const created_at = nowSql();

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Optional stock deduction when the part is linked to a stock item.
      const stockId = req.body.stock_id || null;
      if (stockId) {
        const [stockRows] = await conn.execute('SELECT qty FROM stock_items WHERE id = ?', [stockId]);
        if (stockRows.length === 0) {
          return res.json({ success: false, message: 'Stok kalemi bulunamadı.' });
        }
        if (Number(stockRows[0].qty) < numericQty) {
          return res.json({ success: false, message: `Yetersiz stok. Mevcut: ${stockRows[0].qty}` });
        }
        await conn.execute(
          'UPDATE stock_items SET qty = qty - ?, available_qty = COALESCE(available_qty, qty) - ?, updated_at = ? WHERE id = ?',
          [numericQty, numericQty, created_at, stockId]
        );
        await conn.execute(
          `INSERT INTO stock_movements (stock_id, move_type, qty, ref_type, receiver, user_id, notes)
           VALUES (?, 'Çıkış', ?, 'service', ?, ?, ?)`,
          [stockId, numericQty, part_name.trim(), req.body.user_id || null, `Servis fişi #${ticket_id}`]
        );
      }

      const [result] = await conn.execute(
        `INSERT INTO used_parts
          (ticket_id, part_name, qty, unit_price, total_price, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ticket_id, cleanText(part_name), numericQty, numericUnitPrice, totalPrice, created_at]
      );

      await conn.execute(
        `UPDATE service_tickets
         SET total_cost = COALESCE(total_cost, 0) + ?, updated_at = ?
         WHERE id = ?`,
        [totalPrice, created_at, ticket_id]
      ).catch(() => {});

      await conn.commit();
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Servis parçası eklendi.', ticket_id });
      res.json({ success: true, id: result.insertId });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[parca-ekle]', err);
      res.status(500).json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.delete('/api/parca-sil/:id', async (req, res) => {
    let conn;
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Geçersiz parça id.' });

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute('SELECT ticket_id, total_price FROM used_parts WHERE id = ?', [id]);
      const part = rows[0];

      const [result] = await conn.execute('DELETE FROM used_parts WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Parça bulunamadı.' });
      }

      if (part) {
        await conn.execute(
          `UPDATE service_tickets
           SET total_cost = GREATEST(0, COALESCE(total_cost, 0) - ?), updated_at = ?
           WHERE id = ?`,
          [Number(part.total_price || 0), nowSql(), part.ticket_id]
        ).catch(() => {});
      }

      await conn.commit();
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Servis parçası silindi.', ticket_id: part?.ticket_id });
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[parca-sil]', err);
      res.status(500).json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.put('/api/fis-guncelle/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Geçersiz fiş id.' });
      }

      const body = { ...req.body };
      if (body.delivered_to !== undefined && body.user_name === undefined) body.user_name = body.delivered_to;
      if (body.teslim_eden !== undefined && body.user_name === undefined) body.user_name = body.teslim_eden;

      const allowedFields = [
        'status',
        'priority',
        'notes',
        'fault_desc',
        'delivery_date',
        'user_name',
        'asset_tag',
        'serial_no',
        'model_name',
        'asset_name',
        'location_name',
        'teknisyen',
        'record_type',
        'mac_address',
        'os_name',
        'os_license',
      ];

      const updateFields = [];
      const values = [];

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updateFields.push(`${field} = ?`);
          values.push(cleanText(body[field]));
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, message: 'Güncellenecek alan yok.' });
      }

      const updated_at = nowSql();
      updateFields.push('updated_at = ?');
      values.push(updated_at, id);

      const [result] = await pool.execute(
        `UPDATE service_tickets SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Servis fişi bulunamadı.' });
      }

      emit.safeEmit('veriler-guncellendi', { mesaj: 'Servis fişi güncellendi.', id });
      res.json({ success: true, id, changedRows: result.changedRows });
    } catch (err) {
      console.error('[fis-guncelle]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/fis-sil/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Geçersiz fiş id.' });
      }

      const [result] = await pool.execute('DELETE FROM service_tickets WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Servis fişi bulunamadı.' });
      }

      emit.safeEmit('veriler-guncellendi', { mesaj: 'Servis fişi silindi.', id });
      res.json({ success: true });
    } catch (err) {
      console.error('[fis-sil]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });
};
