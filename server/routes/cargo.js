'use strict';

const express = require('express');

// Kargo firmalarına özel otomatik takip linki oluşturucu
function getCarrierTrackingUrl(carrier, trackingNumber) {
  if (!trackingNumber) return '';
  const num = encodeURIComponent(String(trackingNumber).trim());
  const c = String(carrier || '').toLowerCase();

  if (c.includes('yurtiçi') || c.includes('yurtici')) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${num}`;
  }
  if (c.includes('aras')) {
    return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${num}`;
  }
  if (c.includes('mng')) {
    return `https://www.mngkargo.com.tr/gonderitakip?takipNo=${num}`;
  }
  if (c.includes('sürat') || c.includes('surat')) {
    return `https://suratkargo.com.tr/KargoTakip/?kargotakipno=${num}`;
  }
  if (c.includes('ptt')) {
    return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${num}`;
  }
  if (c.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${num}`;
  }
  if (c.includes('dhl')) {
    return `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${num}`;
  }
  if (c.includes('kolay gelsin')) {
    return `https://esube.kolaygelsin.com/shipments?trackingNumber=${num}`;
  }
  if (c.includes('hepsijet')) {
    return `https://hepsijet.com/gonderi-takibi/${num}`;
  }
  if (c.includes('trendyol')) {
    return `https://kargotakip.trendyol.com/?trackingNumber=${num}`;
  }
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${num}`;
  }
  return '';
}

module.exports = function (app, ctx) {
  const { pool, helpers, emit } = ctx;

  // 1. Tablo ve Sütun Kontrolü: cargo_shipments
  (async () => {
    try {
      if (pool) {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS cargo_shipments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            direction VARCHAR(20) NOT NULL DEFAULT 'incoming',
            status VARCHAR(50) NOT NULL DEFAULT 'Teslim Alındı',
            tracking_number VARCHAR(100) NULL,
            waybill_no VARCHAR(20) NULL,
            carrier VARCHAR(50) NOT NULL DEFAULT 'Yurtiçi Kargo',
            carrier_tracking_url VARCHAR(500) NULL,
            sender VARCHAR(150) NULL,
            recipient_id INT NULL,
            recipient_name VARCHAR(150) NOT NULL,
            receiver_address TEXT NULL,
            receiver_phone VARCHAR(50) NULL,
            department VARCHAR(100) NULL,
            package_type VARCHAR(50) DEFAULT 'Laptop / Bilgisayar',
            package_count INT DEFAULT 1,
            received_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            received_by VARCHAR(100) DEFAULT 'IT Ekibi',
            asset_id INT NULL,
            asset_tag VARCHAR(100) NULL,
            asset_name VARCHAR(150) NULL,
            serial_no VARCHAR(100) NULL,
            model_name VARCHAR(150) NULL,
            device_user VARCHAR(150) NULL,
            create_service_ticket TINYINT(1) DEFAULT 0,
            service_ticket_id INT NULL,
            service_ticket_no VARCHAR(50) NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_direction (direction),
            INDEX idx_recipient (recipient_name),
            INDEX idx_received_date (received_date),
            INDEX idx_waybill (waybill_no),
            INDEX idx_asset_tag (asset_tag)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Var olan tablolara yeni kolonları ekleme kontrolü
        const [cols] = await pool.query('SHOW COLUMNS FROM cargo_shipments');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('direction')) {
          await pool.query("ALTER TABLE cargo_shipments ADD COLUMN direction VARCHAR(20) NOT NULL DEFAULT 'incoming' AFTER id");
        }
        if (!colNames.includes('status')) {
          await pool.query("ALTER TABLE cargo_shipments ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Teslim Alındı' AFTER direction");
        }
        if (!colNames.includes('receiver_address')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN receiver_address TEXT NULL DEFAULT NULL AFTER recipient_name');
        }
        if (!colNames.includes('receiver_phone')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN receiver_phone VARCHAR(50) NULL DEFAULT NULL AFTER receiver_address');
        }
        if (!colNames.includes('waybill_no')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN waybill_no VARCHAR(20) NULL DEFAULT NULL AFTER tracking_number');
        }
        if (!colNames.includes('asset_id')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN asset_id INT NULL DEFAULT NULL');
        }
        if (!colNames.includes('asset_tag')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN asset_tag VARCHAR(100) NULL DEFAULT NULL');
        }
        if (!colNames.includes('asset_name')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN asset_name VARCHAR(150) NULL DEFAULT NULL');
        }
        if (!colNames.includes('serial_no')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN serial_no VARCHAR(100) NULL DEFAULT NULL');
        }
        if (!colNames.includes('model_name')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN model_name VARCHAR(150) NULL DEFAULT NULL');
        }
        if (!colNames.includes('device_user')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN device_user VARCHAR(150) NULL DEFAULT NULL AFTER model_name');
        }
        if (!colNames.includes('create_service_ticket')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN create_service_ticket TINYINT(1) DEFAULT 0');
        }
        if (!colNames.includes('service_ticket_no')) {
          await pool.query('ALTER TABLE cargo_shipments ADD COLUMN service_ticket_no VARCHAR(50) NULL DEFAULT NULL');
        }

        // Eski veya İngilizce kalmış durum kayıtlarını Türkçe'ye normalize et
        await pool.query("UPDATE cargo_shipments SET status = 'Teslim Alındı' WHERE status = 'received' OR status = 'received_by_it' OR status IS NULL OR status = ''");
        await pool.query("UPDATE cargo_shipments SET status = 'Gönderildi' WHERE status = 'sent' OR status = 'shipped'");

        console.log('[MySQL] cargo_shipments table & columns ensured.');
      }
    } catch (e) {
      console.warn('[Cargo Module Init Error]:', e.message);
    }
  })();

  // 2. Kargo İstatistikleri
  app.get('/api/cargo/stats', async (req, res) => {
    try {
      const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM cargo_shipments');
      const [incomingRows] = await pool.query("SELECT COUNT(*) as incoming_count FROM cargo_shipments WHERE direction = 'incoming' OR direction IS NULL");
      const [outgoingRows] = await pool.query("SELECT COUNT(*) as outgoing_count FROM cargo_shipments WHERE direction = 'outgoing'");
      const [todayRows] = await pool.query('SELECT COUNT(*) as today FROM cargo_shipments WHERE DATE(received_date) = CURDATE()');
      const [ticketRows] = await pool.query('SELECT COUNT(*) as service_count FROM cargo_shipments WHERE service_ticket_id IS NOT NULL');
      const [waybillRows] = await pool.query("SELECT COUNT(*) as waybill_count FROM cargo_shipments WHERE waybill_no IS NOT NULL AND waybill_no != ''");
      const [assetRows] = await pool.query("SELECT COUNT(*) as asset_count FROM cargo_shipments WHERE asset_tag IS NOT NULL AND asset_tag != ''");

      res.json({
        success: true,
        data: {
          total: totalRows[0]?.total || 0,
          incoming_count: incomingRows[0]?.incoming_count || 0,
          outgoing_count: outgoingRows[0]?.outgoing_count || 0,
          today: todayRows[0]?.today || 0,
          service_count: ticketRows[0]?.service_count || 0,
          waybill_count: waybillRows[0]?.waybill_count || 0,
          asset_count: assetRows[0]?.asset_count || 0,
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Kargo Listesi
  app.get('/api/cargo', async (req, res) => {
    try {
      const { direction = 'all', carrier, search, startDate, endDate, limit = 500 } = req.query;

      let sql = 'SELECT * FROM cargo_shipments WHERE 1=1';
      const params = [];

      if (direction && direction !== 'all') {
        if (direction === 'incoming') {
          sql += " AND (direction = 'incoming' OR direction IS NULL)";
        } else if (direction === 'outgoing') {
          sql += " AND direction = 'outgoing'";
        }
      }

      if (carrier && carrier !== 'all') {
        sql += ' AND carrier = ?';
        params.push(carrier);
      }

      if (startDate) {
        sql += ' AND DATE(received_date) >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND DATE(received_date) <= ?';
        params.push(endDate);
      }

      if (search) {
        const s = `%${search.trim()}%`;
        sql += ' AND (tracking_number LIKE ? OR waybill_no LIKE ? OR recipient_name LIKE ? OR sender LIKE ? OR department LIKE ? OR asset_tag LIKE ? OR serial_no LIKE ? OR service_ticket_no LIKE ? OR notes LIKE ? OR receiver_address LIKE ? OR receiver_phone LIKE ? OR status LIKE ?)';
        params.push(s, s, s, s, s, s, s, s, s, s, s, s);
      }

      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(Number(limit) || 500);

      const [rows] = await pool.query(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Yeni Kargo Girişi / Gönderimi
  app.post('/api/cargo', async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const {
        direction = 'incoming',
        status,
        tracking_number,
        waybill_no,
        carrier = 'Yurtiçi Kargo',
        carrier_tracking_url,
        sender,
        recipient_id,
        recipient_name,
        receiver_address,
        receiver_phone,
        department,
        package_type = 'Laptop / Bilgisayar',
        package_count = 1,
        received_date,
        received_by = 'IT Ekibi',
        asset_id,
        asset_tag,
        asset_name,
        serial_no,
        model_name,
        device_user,
        create_service_ticket = false,
        fault_desc,
        notes
      } = req.body;

      if (!recipient_name) {
        return res.status(400).json({ success: false, error: 'Alıcı adı zorunludur.' });
      }

      const defaultStatus = direction === 'outgoing' ? 'Gönderildi' : 'Teslim Alındı';
      const finalStatus = status || defaultStatus;

      const autoUrl = carrier_tracking_url || getCarrierTrackingUrl(carrier, tracking_number);
      const finalDate = received_date ? new Date(received_date) : new Date();

      await conn.beginTransaction();

      let createdTicketId = null;
      let createdTicketNo = null;

      // 1. Bilgisayarın Gerçek Sahibi / Kullanıcısı (service_tickets.user_name):
      let finalOwnerName = device_user ? String(device_user).trim() : '';

      if (!finalOwnerName && (asset_tag || asset_id)) {
        try {
          const [assetRows] = await conn.execute(
            'SELECT assigned_to_user_name FROM cached_assets WHERE asset_tag = ? OR id = ? LIMIT 1',
            [asset_tag || '', asset_id || 0]
          );
          if (assetRows.length && assetRows[0].assigned_to_user_name) {
            finalOwnerName = assetRows[0].assigned_to_user_name.trim();
          }
        } catch (err) {
          console.warn('[Cargo] cached_assets query error:', err.message);
        }
      }

      if (!finalOwnerName) {
        if (direction === 'outgoing') {
          finalOwnerName = recipient_name ? recipient_name.trim() : 'Zimmetli Kullanıcı';
        } else {
          finalOwnerName = sender ? sender.trim() : 'Cihaz Kullanıcısı';
        }
      }

      // 2. Onarımı Yapacak / Cihazı Teslim Alan Teknisyen (service_tickets.teknisyen):
      // Gelen kargoda alıcı personel (recipient_name, ör: İsmail KARA) cihazı teslim alıp onaracak IT teknisyenidir.
      const finalTechnician = (direction === 'incoming' && recipient_name)
        ? recipient_name.trim()
        : (received_by || 'IT Ekibi');

      // Eğer servis fişi oluşturma tiki işaretlenmişse otomatik servis fişi oluştur
      if (create_service_ticket) {
        if (helpers?.generateTicketNo) {
          createdTicketNo = await helpers.generateTicketNo(conn);
        } else {
          const [last] = await conn.execute('SELECT ticket_no FROM service_tickets ORDER BY id DESC LIMIT 1');
          const lastNo = last[0]?.ticket_no || 'ST-0000';
          const num = parseInt(lastNo.replace(/\D/g, ''), 10) || 0;
          createdTicketNo = `ST-${String(num + 1).padStart(4, '0')}`;
        }

        const now = helpers?.nowSql ? helpers.nowSql() : new Date().toISOString().slice(0, 19).replace('T', ' ');
        const finalModelName = model_name || asset_name || package_type || 'Bilinmeyen Cihaz';
        const finalFault = fault_desc || (direction === 'outgoing' 
          ? `Kargo Çıkışı (${carrier}) - ${notes || 'Kargo ile gönderilen cihaz'}`
          : `Kargo Kabul (${carrier}) - ${notes || 'Kargo ile gelen cihaz servis kaydı'}`);
        
        const serviceNotes = direction === 'outgoing'
          ? `[Giden Kargo Çıkışı] Firma: ${carrier} | Takip No: ${tracking_number || 'Yok'} | İrsaliye No: ${waybill_no || 'Yok'} | Alıcı: ${recipient_name || 'Yok'}`
          : `[Gelen Kargo Girişi] Firma: ${carrier} | Takip No: ${tracking_number || 'Yok'} | İrsaliye No: ${waybill_no || 'Yok'} | Gönderen: ${sender || 'Yok'}`;

        const [ticketResult] = await conn.execute(`
          INSERT INTO service_tickets
            (ticket_no, created_at, updated_at, asset_tag, serial_no, model_name, asset_name,
             location_name, fault_desc, priority, status, notes, user_name, teknisyen, record_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Normal', 'Yeni Kayıt', ?, ?, ?, 'service')
        `, [
          createdTicketNo,
          now,
          now,
          asset_tag || null,
          serial_no || null,
          finalModelName,
          asset_name || null,
          department || 'BYS Depo',
          finalFault,
          serviceNotes,
          finalOwnerName,
          finalTechnician
        ]);

        createdTicketId = ticketResult.insertId;
      }

      // Kargo kaydını ekle
      const [cargoResult] = await conn.execute(`
        INSERT INTO cargo_shipments (
          direction, status, tracking_number, waybill_no, carrier, carrier_tracking_url,
          sender, recipient_id, recipient_name, receiver_address, receiver_phone,
          department, package_type, package_count, received_date, received_by,
          asset_id, asset_tag, asset_name, serial_no, model_name, device_user,
          create_service_ticket, service_ticket_id, service_ticket_no,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        direction || 'incoming',
        finalStatus,
        tracking_number || null,
        waybill_no ? String(waybill_no).trim().slice(0, 16) : null,
        carrier || 'Diğer',
        autoUrl || null,
        sender || null,
        recipient_id || null,
        recipient_name.trim(),
        receiver_address || null,
        receiver_phone || null,
        department || null,
        package_type || 'Laptop / Bilgisayar',
        Number(package_count) || 1,
        finalDate,
        received_by || 'IT Ekibi',
        asset_id || null,
        asset_tag || null,
        asset_name || null,
        serial_no || null,
        model_name || null,
        finalOwnerName || null,
        create_service_ticket ? 1 : 0,
        createdTicketId,
        createdTicketNo,
        notes || null
      ]);

      await conn.commit();

      if (emit && typeof emit.safeEmit === 'function' && createdTicketNo) {
        emit.safeEmit('ticket:created', { ticket_no: createdTicketNo, id: createdTicketId });
      }

      const successMsg = direction === 'outgoing'
        ? (createdTicketNo ? `Giden kargo kaydedildi ve #${createdTicketNo} Servis Fişi bağlandı!` : 'Giden kargo kaydı başarıyla oluşturuldu.')
        : (createdTicketNo ? `Kargo girişi yapıldı ve #${createdTicketNo} Servis Fişi otomatik oluşturuldu!` : 'Kargo girişi başarıyla kaydedildi.');

      res.json({
        success: true,
        id: cargoResult.insertId,
        service_ticket_id: createdTicketId,
        service_ticket_no: createdTicketNo,
        message: successMsg
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ success: false, error: err.message });
    } finally {
      conn.release();
    }
  });

  // 5. Kargo Güncelle
  app.put('/api/cargo/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { id } = req.params;
      const {
        direction = 'incoming',
        status,
        tracking_number,
        waybill_no,
        carrier,
        carrier_tracking_url,
        sender,
        recipient_id,
        recipient_name,
        receiver_address,
        receiver_phone,
        department,
        package_type,
        package_count,
        received_date,
        received_by,
        asset_id,
        asset_tag,
        asset_name,
        serial_no,
        model_name,
        device_user,
        create_service_ticket,
        fault_desc,
        notes
      } = req.body;

      const autoUrl = carrier_tracking_url || getCarrierTrackingUrl(carrier, tracking_number);

      await conn.beginTransaction();

      // Mevcut kargo kaydını sorgula
      const [existing] = await conn.execute('SELECT * FROM cargo_shipments WHERE id = ?', [id]);
      if (existing.length === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Kargo kaydı bulunamadı.' });
      }

      let currentTicketId = existing[0].service_ticket_id;
      let currentTicketNo = existing[0].service_ticket_no;

      // Eğer önceden bağlı fiş varsa düzenleme esnasında create_service_ticket kaldırılamaz!
      const finalCreateServiceTicket = currentTicketId ? 1 : (create_service_ticket ? 1 : 0);

      // Cihaz kullanıcısı / sahibi
      let finalOwnerName = device_user ? String(device_user).trim() : (existing[0].device_user || '');

      if (!finalOwnerName && (asset_tag || asset_id)) {
        try {
          const [assetRows] = await conn.execute(
            'SELECT assigned_to_user_name FROM cached_assets WHERE asset_tag = ? OR id = ? LIMIT 1',
            [asset_tag || existing[0].asset_tag || '', asset_id || existing[0].asset_id || 0]
          );
          if (assetRows.length && assetRows[0].assigned_to_user_name) {
            finalOwnerName = assetRows[0].assigned_to_user_name.trim();
          }
        } catch (err) {
          console.warn('[Cargo] cached_assets query error:', err.message);
        }
      }

      if (!finalOwnerName) {
        if (direction === 'outgoing') {
          finalOwnerName = recipient_name ? recipient_name.trim() : 'Zimmetli Kullanıcı';
        } else {
          finalOwnerName = sender ? sender.trim() : 'Cihaz Kullanıcısı';
        }
      }

      // Onarımı yapacak IT teknisyeni
      const finalTechnician = (direction === 'incoming' && recipient_name)
        ? recipient_name.trim()
        : (received_by || existing[0].received_by || 'IT Ekibi');

      // Eğer önceden fişi yoksa ve yeni işaretlendiyse servis fişi oluştur
      if (create_service_ticket && !currentTicketId) {
        if (helpers?.generateTicketNo) {
          currentTicketNo = await helpers.generateTicketNo(conn);
        } else {
          const [last] = await conn.execute('SELECT ticket_no FROM service_tickets ORDER BY id DESC LIMIT 1');
          const lastNo = last[0]?.ticket_no || 'ST-0000';
          const num = parseInt(lastNo.replace(/\D/g, ''), 10) || 0;
          currentTicketNo = `ST-${String(num + 1).padStart(4, '0')}`;
        }

        const now = helpers?.nowSql ? helpers.nowSql() : new Date().toISOString().slice(0, 19).replace('T', ' ');
        const finalModelName = model_name || asset_name || package_type || 'Bilinmeyen Cihaz';
        const finalFault = fault_desc || (direction === 'outgoing' 
          ? `Kargo Çıkışı (${carrier}) - ${notes || 'Kargo ile gönderilen cihaz'}`
          : `Kargo Kabul (${carrier}) - ${notes || 'Kargo ile gelen cihaz servis kaydı'}`);
        
        const serviceNotes = direction === 'outgoing'
          ? `[Giden Kargo Çıkışı] Firma: ${carrier} | Takip No: ${tracking_number || 'Yok'} | İrsaliye No: ${waybill_no || 'Yok'} | Alıcı: ${recipient_name || 'Yok'}`
          : `[Gelen Kargo Girişi] Firma: ${carrier} | Takip No: ${tracking_number || 'Yok'} | İrsaliye No: ${waybill_no || 'Yok'} | Gönderen: ${sender || 'Yok'}`;

        const [ticketResult] = await conn.execute(`
          INSERT INTO service_tickets
            (ticket_no, created_at, updated_at, asset_tag, serial_no, model_name, asset_name,
             location_name, fault_desc, priority, status, notes, user_name, teknisyen, record_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Normal', 'Yeni Kayıt', ?, ?, ?, 'service')
        `, [
          currentTicketNo,
          now,
          now,
          asset_tag || null,
          serial_no || null,
          finalModelName,
          asset_name || null,
          department || 'BYS Depo',
          finalFault,
          serviceNotes,
          finalOwnerName,
          finalTechnician
        ]);

        currentTicketId = ticketResult.insertId;
      }

      await conn.execute(`
        UPDATE cargo_shipments SET
          direction = ?,
          status = ?,
          tracking_number = ?,
          waybill_no = ?,
          carrier = ?,
          carrier_tracking_url = ?,
          sender = ?,
          recipient_id = ?,
          recipient_name = ?,
          receiver_address = ?,
          receiver_phone = ?,
          department = ?,
          package_type = ?,
          package_count = ?,
          received_date = ?,
          received_by = ?,
          asset_id = ?,
          asset_tag = ?,
          asset_name = ?,
          serial_no = ?,
          model_name = ?,
          device_user = ?,
          create_service_ticket = ?,
          service_ticket_id = ?,
          service_ticket_no = ?,
          notes = ?
        WHERE id = ?
      `, [
        direction || existing[0].direction || 'incoming',
        status || existing[0].status || 'Teslim Alındı',
        tracking_number || null,
        waybill_no ? String(waybill_no).trim().slice(0, 16) : null,
        carrier || 'Diğer',
        autoUrl || null,
        sender || null,
        recipient_id || null,
        recipient_name || 'Bilinmiyor',
        receiver_address || null,
        receiver_phone || null,
        department || null,
        package_type || 'Laptop / Bilgisayar',
        Number(package_count) || 1,
        received_date ? new Date(received_date) : new Date(),
        received_by || 'IT Ekibi',
        asset_id || null,
        asset_tag || null,
        asset_name || null,
        serial_no || null,
        model_name || null,
        finalOwnerName || null,
        finalCreateServiceTicket,
        currentTicketId || null,
        currentTicketNo || null,
        notes || null,
        id
      ]);

      await conn.commit();

      res.json({
        success: true,
        service_ticket_id: currentTicketId,
        service_ticket_no: currentTicketNo,
        message: 'Kargo bilgisi güncellendi.'
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ success: false, error: err.message });
    } finally {
      conn.release();
    }
  });

  // 6. Kargo Silme
  app.delete('/api/cargo/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM cargo_shipments WHERE id = ?', [id]);
      res.json({ success: true, message: 'Kargo kaydı silindi.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
};
