'use strict';

module.exports = function registerMaintenance(app, { pool, helpers, emit, snipeitService }) {
  const { dbError, insertAuditLog } = helpers;

  // Auto-create database tables
  (async () => {
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS maintenance_plans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          company_name VARCHAR(255) NOT NULL,
          title VARCHAR(255) NOT NULL,
          period VARCHAR(100) DEFAULT '2026/1. Dönem',
          planned_date DATE DEFAULT NULL,
          status VARCHAR(50) DEFAULT 'Planlandı',
          total_devices INT DEFAULT 0,
          completed_devices INT DEFAULT 0,
          created_by VARCHAR(100) DEFAULT NULL,
          completed_at DATETIME DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS maintenance_item_checks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          plan_id INT NOT NULL,
          asset_id INT NULL,
          asset_tag VARCHAR(100) DEFAULT NULL,
          asset_name VARCHAR(255) DEFAULT NULL,
          model_name VARCHAR(255) DEFAULT NULL,
          serial_no VARCHAR(255) DEFAULT NULL,
          assigned_user VARCHAR(255) DEFAULT NULL,
          location_name VARCHAR(255) DEFAULT NULL,
          status VARCHAR(50) DEFAULT 'Bekliyor',
          check_dust TINYINT(1) DEFAULT 0,
          check_fan TINYINT(1) DEFAULT 0,
          check_visual_audio TINYINT(1) DEFAULT 0,
          check_performance TINYINT(1) DEFAULT 0,
          check_ports TINYINT(1) DEFAULT 0,
          check_antivirus TINYINT(1) DEFAULT 0,
          check_license TINYINT(1) DEFAULT 0,
          check_network TINYINT(1) DEFAULT 0,
          check_standard_software TINYINT(1) DEFAULT 0,
          check_keyboard_mouse TINYINT(1) DEFAULT 0,
          check_printer_drum TINYINT(1) DEFAULT 0,
          tech_name VARCHAR(150) DEFAULT NULL,
          technician_id INT DEFAULT NULL,
          completed_at DATETIME DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_plan (plan_id),
          INDEX idx_asset (asset_tag)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_calendar_notes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          user_name VARCHAR(150) NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          note_date DATE NOT NULL,
          color VARCHAR(50) DEFAULT 'rose',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_date (note_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('[Maintenance] Tables ensured.');
      try {
        await pool.execute('ALTER TABLE cached_locations ADD COLUMN manager_id INT NULL');
      } catch (e) {}
      try {
        await pool.execute('ALTER TABLE cached_locations ADD COLUMN manager_name VARCHAR(255) NULL');
      } catch (e) {}
      try {
        await pool.execute('ALTER TABLE cached_locations ADD COLUMN company_id INT NULL');
      } catch (e) {}
      try {
        await pool.execute('ALTER TABLE cached_locations ADD COLUMN company_name VARCHAR(255) NULL');
      } catch (e) {}
    } catch (e) {
      console.warn('[Maintenance] Table setup warning:', e.message);
    }
  })();

  // 1. Get Companies & Locations for Planning dropdowns
  app.get('/api/maintenance/meta', async (req, res) => {
    try {
      let companies = [];
      try {
        const [compRows] = await pool.query('SELECT DISTINCT name FROM cached_companies WHERE name IS NOT NULL AND name != "" ORDER BY name ASC');
        companies = compRows.map(r => r.name);
      } catch (e) {}

      if (companies.length === 0) {
        try {
          const [locRows] = await pool.query('SELECT DISTINCT name FROM cached_locations WHERE name IS NOT NULL AND name != "" ORDER BY name ASC');
          companies = locRows.map(r => r.name);
        } catch (e) {}
      }

      let locations = [];
      try {
        const [locRows] = await pool.query('SELECT DISTINCT name FROM cached_locations WHERE name IS NOT NULL AND name != "" ORDER BY name ASC');
        locations = locRows.map(r => r.name);
      } catch (e) {}

      res.json({ success: true, companies, locations });
    } catch (err) {
      dbError(res, err, 'maintenance:meta');
    }
  });

  // 2. Preview Device Count for a company/location filter
  app.post('/api/maintenance/preview-assets', async (req, res) => {
    try {
      const { company, location, search } = req.body;
      let sql = `
        SELECT * FROM cached_assets 
        WHERE 1=1 
          AND (category_name IS NULL OR (LOWER(category_name) NOT LIKE '%yazıcı%' AND LOWER(category_name) NOT LIKE '%printer%' AND LOWER(category_name) NOT LIKE '%toner%' AND LOWER(category_name) NOT LIKE '%kartuş%'))
          AND (model_name IS NULL OR (LOWER(model_name) NOT LIKE '%laserjet%' AND LOWER(model_name) NOT LIKE '%pagewide%' AND LOWER(model_name) NOT LIKE '%deskjet%' AND LOWER(model_name) NOT LIKE '%officejet%'))
      `;
      const params = [];

      if (location) {
        sql += ' AND location_name = ?';
        params.push(location);
      }
      if (search) {
        sql += ' AND (name LIKE ? OR asset_tag LIKE ? OR model_name LIKE ? OR assigned_to_user_name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }

      const [rows] = await pool.query(sql, params);
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      dbError(res, err, 'maintenance:preview-assets');
    }
  });

  // 3. List Maintenance Plans
  app.get('/api/maintenance/plans', async (req, res) => {
    try {
      const [plans] = await pool.query(`
        SELECT p.*,
          (SELECT COUNT(*) FROM maintenance_item_checks WHERE plan_id = p.id) AS total_devices,
          (SELECT COUNT(*) FROM maintenance_item_checks WHERE plan_id = p.id AND status = 'Tamamlandı') AS completed_devices
        FROM maintenance_plans p
        ORDER BY p.id DESC
      `);
      res.json({ success: true, data: plans });
    } catch (err) {
      dbError(res, err, 'maintenance:plans');
    }
  });

  // 4. Create New Maintenance Plan
  app.post('/api/maintenance/plans', async (req, res) => {
    let conn;
    try {
      const { company_name, title, period, planned_date, notes, location, custom_assets, actor } = req.body;
      if (!company_name || !title) {
        return res.status(400).json({ success: false, message: 'Şirket/İşletme adı ve plan başlığı zorunludur.' });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Find matching assets from cached_assets (excluding printers)
      let targetAssets = [];
      if (Array.isArray(custom_assets) && custom_assets.length > 0) {
        targetAssets = custom_assets;
      } else {
        let sql = `
          SELECT * FROM cached_assets 
          WHERE 1=1
            AND (category_name IS NULL OR (LOWER(category_name) NOT LIKE '%yazıcı%' AND LOWER(category_name) NOT LIKE '%printer%' AND LOWER(category_name) NOT LIKE '%toner%' AND LOWER(category_name) NOT LIKE '%kartuş%'))
            AND (model_name IS NULL OR (LOWER(model_name) NOT LIKE '%laserjet%' AND LOWER(model_name) NOT LIKE '%pagewide%' AND LOWER(model_name) NOT LIKE '%deskjet%' AND LOWER(model_name) NOT LIKE '%officejet%'))
        `;
        const params = [];
        if (location) {
          sql += ' AND location_name = ?';
          params.push(location);
        }
        const [assets] = await conn.query(sql, params);
        targetAssets = assets;
      }

      const [planResult] = await conn.execute(
        `INSERT INTO maintenance_plans (company_name, title, period, planned_date, status, total_devices, completed_devices, created_by, notes)
         VALUES (?, ?, ?, ?, 'Planlandı', ?, 0, ?, ?)`,
        [
          company_name,
          title,
          period || '2026/1. Dönem',
          planned_date || new Date().toISOString().slice(0, 10),
          targetAssets.length,
          actor?.full_name || actor?.name || actor?.username || 'Sistem',
          notes || null
        ]
      );

      const planId = planResult.insertId;

      // Populate maintenance_item_checks
      for (const asset of targetAssets) {
        await conn.execute(
          `INSERT INTO maintenance_item_checks 
           (plan_id, asset_id, asset_tag, asset_name, model_name, serial_no, assigned_user, location_name, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Bekliyor')`,
          [
            planId,
            asset.id || null,
            asset.asset_tag || asset.tag || '',
            asset.name || asset.model_name || 'Bilgisayar',
            asset.model_name || asset.model || '',
            asset.serial || asset.serial_no || '',
            asset.assigned_to_user_name || asset.assigned_user || '',
            asset.location_name || location || ''
          ]
        );
      }

      await insertAuditLog(conn, {
        user: actor,
        action: 'CREATE',
        module: 'maintenance',
        refId: planId,
        description: `"${title}" (${company_name}) için ${targetAssets.length} cihazlık periyodik bakım planı oluşturuldu.`
      });

      await conn.commit();
      res.json({ success: true, id: planId, total_devices: targetAssets.length });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'maintenance:create-plan');
    } finally {
      if (conn) conn.release();
    }
  });

  // 5. Get Plan Detail & All Item Checks
  app.get('/api/maintenance/plans/:id', async (req, res) => {
    try {
      const planId = Number(req.params.id);
      const [plans] = await pool.query('SELECT * FROM maintenance_plans WHERE id = ?', [planId]);
      if (plans.length === 0) {
        return res.status(404).json({ success: false, message: 'Bakım planı bulunamadı.' });
      }

      const [items] = await pool.query('SELECT * FROM maintenance_item_checks WHERE plan_id = ? ORDER BY status DESC, id ASC', [planId]);
      
      const total = items.length;
      const completed = items.filter(i => i.status === 'Tamamlandı').length;

      // Find Location Manager (İşletme Müdürü) from Snipe-IT cached_locations or Snipe-IT API
      let locationManager = '';
      try {
        const locNames = [...new Set(items.map(i => i.location_name).filter(Boolean))];
        if (locNames.length > 0) {
          const [locRows] = await pool.query('SELECT manager_name FROM cached_locations WHERE name IN (?) AND manager_name IS NOT NULL AND manager_name != "" LIMIT 1', [locNames]);
          if (locRows.length > 0 && locRows[0].manager_name) {
            locationManager = locRows[0].manager_name;
          }
        }
        if (!locationManager && plans[0].company_name) {
          const [compLocRows] = await pool.query('SELECT manager_name FROM cached_locations WHERE name LIKE ? AND manager_name IS NOT NULL AND manager_name != "" LIMIT 1', [`%${plans[0].company_name}%`]);
          if (compLocRows.length > 0 && compLocRows[0].manager_name) {
            locationManager = compLocRows[0].manager_name;
          }
        }

        // If not found in cache, fetch directly from Snipe-IT API and update cache
        if (!locationManager && snipeitService) {
          try {
            const client = snipeitService.getClient();
            const locRes = await client.get('/locations?limit=200');
            const allLocs = locRes.data?.rows || [];
            for (const l of allLocs) {
              const mgrName = l.manager?.name || l.manager?.formatted || '';
              if (mgrName) {
                await pool.execute(
                  'UPDATE cached_locations SET manager_name = ?, manager_id = ? WHERE id = ? OR name = ?',
                  [mgrName, l.manager?.id || null, l.id, l.name]
                ).catch(() => {});
              }
              if (!locationManager) {
                if (locNames.includes(l.name) && mgrName) {
                  locationManager = mgrName;
                } else if (l.company?.name && plans[0].company_name && l.company.name.toLowerCase().includes(plans[0].company_name.toLowerCase()) && mgrName) {
                  locationManager = mgrName;
                }
              }
            }
          } catch (apiErr) {
            console.warn('[Maintenance] Live Snipe-IT location manager fetch warning:', apiErr.message);
          }
        }
      } catch (e) {
        console.warn('[Maintenance] Location manager resolution error:', e.message);
      }

      // Find primary technician / responsible manager
      let leadTech = '';
      const completedTechs = items.map(i => i.tech_name).filter(Boolean);
      if (completedTechs.length > 0) {
        leadTech = completedTechs[0];
      }

      res.json({
        success: true,
        plan: {
          ...plans[0],
          manager_name: locationManager || '',
          lead_technician: leadTech || '',
          total_devices: total,
          completed_devices: completed
        },
        items
      });
    } catch (err) {
      dbError(res, err, 'maintenance:get-plan-detail');
    }
  });

  // 6. Save Single Device Check
  app.put('/api/maintenance/items/:id', async (req, res) => {
    let conn;
    try {
      const itemId = Number(req.params.id);
      const {
        check_dust,
        check_fan,
        check_visual_audio,
        check_performance,
        check_ports,
        check_antivirus,
        check_license,
        check_network,
        check_standard_software,
        check_keyboard_mouse,
        check_printer_drum,
        notes,
        actor
      } = req.body;

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Resolve tech name & manager
      let techName = actor?.full_name || actor?.name || actor?.username || 'Teknisyen';
      try {
        if (actor?.id) {
          const [uRows] = await conn.query(`
            SELECT u.full_name, m.full_name as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            WHERE u.id = ?
          `, [actor.id]);
          if (uRows.length > 0) {
            if (uRows[0].manager_name) {
              techName = uRows[0].manager_name;
            } else if (uRows[0].full_name) {
              techName = uRows[0].full_name;
            }
          }
        }
      } catch (e) {}

      // Check required flags
      const isComplete = Boolean(
        check_dust &&
        check_fan &&
        check_visual_audio &&
        check_performance &&
        check_ports &&
        check_antivirus &&
        check_license &&
        check_network &&
        check_standard_software
      );

      const status = isComplete ? 'Tamamlandı' : 'Bekliyor';
      const completedAt = isComplete ? new Date() : null;

      await conn.execute(`
        UPDATE maintenance_item_checks
        SET check_dust = ?,
            check_fan = ?,
            check_visual_audio = ?,
            check_performance = ?,
            check_ports = ?,
            check_antivirus = ?,
            check_license = ?,
            check_network = ?,
            check_standard_software = ?,
            check_keyboard_mouse = ?,
            check_printer_drum = ?,
            tech_name = ?,
            technician_id = ?,
            notes = ?,
            status = ?,
            completed_at = ?
        WHERE id = ?
      `, [
        check_dust ? 1 : 0,
        check_fan ? 1 : 0,
        check_visual_audio ? 1 : 0,
        check_performance ? 1 : 0,
        check_ports ? 1 : 0,
        check_antivirus ? 1 : 0,
        check_license ? 1 : 0,
        check_network ? 1 : 0,
        check_standard_software ? 1 : 0,
        check_keyboard_mouse ? 1 : 0,
        check_printer_drum ? 1 : 0,
        techName,
        actor?.id || null,
        notes || null,
        status,
        completedAt,
        itemId
      ]);

      // Update parent plan counts
      const [itemRows] = await conn.query('SELECT plan_id, asset_tag FROM maintenance_item_checks WHERE id = ?', [itemId]);
      if (itemRows.length > 0) {
        const planId = itemRows[0].plan_id;
        const [counts] = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = "Tamamlandı" THEN 1 ELSE 0 END) as completed FROM maintenance_item_checks WHERE plan_id = ?', [planId]);
        const total = counts[0].total || 0;
        const completed = Number(counts[0].completed || 0);

        let planStatus = 'Devam Ediyor';
        if (completed === total && total > 0) {
          planStatus = 'Tamamlandı';
        } else if (completed === 0) {
          planStatus = 'Planlandı';
        }

        await conn.execute('UPDATE maintenance_plans SET total_devices = ?, completed_devices = ?, status = ? WHERE id = ?', [total, completed, planStatus, planId]);
      }

      await conn.commit();
      res.json({ success: true, status, tech_name: techName });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'maintenance:save-item');
    } finally {
      if (conn) conn.release();
    }
  });

  // 7. Mark Entire Plan as Completed
  app.put('/api/maintenance/plans/:id/complete', async (req, res) => {
    let conn;
    try {
      const planId = Number(req.params.id);
      const { actor } = req.body;

      conn = await pool.getConnection();
      await conn.beginTransaction();

      await conn.execute(`
        UPDATE maintenance_plans
        SET status = 'Tamamlandı',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [planId]);

      await insertAuditLog(conn, {
        user: actor,
        action: 'UPDATE',
        module: 'maintenance',
        refId: planId,
        description: `Bakım planı (#${planId}) tümüyle tamamlandı olarak onaylandı.`
      });

      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'maintenance:complete-plan');
    } finally {
      if (conn) conn.release();
    }
  });

  // 8. Delete Maintenance Plan
  app.delete('/api/maintenance/plans/:id', async (req, res) => {
    let conn;
    try {
      const planId = Number(req.params.id);
      const { actor } = req.body;

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [plans] = await conn.query('SELECT title, company_name FROM maintenance_plans WHERE id = ?', [planId]);
      await conn.execute('DELETE FROM maintenance_item_checks WHERE plan_id = ?', [planId]);
      await conn.execute('DELETE FROM maintenance_plans WHERE id = ?', [planId]);

      if (plans.length > 0) {
        await insertAuditLog(conn, {
          user: actor,
          action: 'DELETE',
          module: 'maintenance',
          refId: planId,
          description: `"${plans[0].title}" (${plans[0].company_name}) bakım planı ve tüm cihaz kayıtları silindi.`
        });
      }

      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      dbError(res, err, 'maintenance:delete-plan');
    } finally {
      if (conn) conn.release();
    }
  });

  // 9. Master Operations Calendar Events
  app.get('/api/maintenance/master-calendar', async (req, res) => {
    try {
      const { start, end } = req.query;
      const now = new Date();
      const formatYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const defaultStart = formatYMD(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      const defaultEnd = formatYMD(new Date(now.getFullYear(), now.getMonth() + 3, 0));
      const startDate = start || defaultStart;
      const endDate = end || defaultEnd;

      const [tickets, cargo, toner, maintenancePlans, maintenanceChecks, notes] = await Promise.all([
        // 1. Servis Fişleri
        pool.query(`
          SELECT id, ticket_no, customer_name, company_name, device_name, fault_description,
                 priority, status, assigned_to, technician_name, created_at, target_date
          FROM service_tickets
          WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
          ORDER BY created_at ASC
        `, [startDate, endDate]).then(([rows]) => rows).catch(() => []),

        // 2. Kargo Hareketleri
        pool.query(`
          SELECT id, direction, status, tracking_number, waybill_no, carrier, sender,
                 recipient_name, department, package_type, package_count, received_date,
                 received_by, asset_tag, asset_name, serial_no, model_name, service_ticket_no,
                 notes, created_at
          FROM cargo_shipments
          WHERE (received_date IS NOT NULL AND DATE(received_date) >= ? AND DATE(received_date) <= ?)
             OR (created_at IS NOT NULL AND DATE(created_at) >= ? AND DATE(created_at) <= ?)
          ORDER BY COALESCE(received_date, created_at) ASC
        `, [startDate, endDate, startDate, endDate]).then(([rows]) => rows).catch(() => []),

        // 3. Toner Teslimatları
        pool.query(`
          SELECT tc.id, tc.asset_id, tc.asset_name, tc.toner_id, tc.change_date, tc.qty,
                 tc.assigned_user_name, tc.page_count, tc.notes,
                 ti.toner_model, ti.color,
                 COALESCE(tc.assigned_user_name, cu.name, tc.asset_name, '—') AS target_name
          FROM toner_changes tc
          LEFT JOIN toner_items ti ON tc.toner_id = ti.id
          LEFT JOIN cached_users cu ON tc.assigned_user_id = cu.id
          WHERE tc.change_date IS NOT NULL AND DATE(tc.change_date) >= ? AND DATE(tc.change_date) <= ?
          ORDER BY tc.change_date ASC
        `, [startDate, endDate]).then(([rows]) => rows).catch(() => []),

        // 4. Periyodik Bakım Planları
        pool.query(`
          SELECT id, title, company_name, period, planned_date, status, total_devices, completed_devices, notes, created_at
          FROM maintenance_plans
          WHERE planned_date IS NOT NULL AND DATE(planned_date) >= ? AND DATE(planned_date) <= ?
          ORDER BY planned_date ASC
        `, [startDate, endDate]).then(([rows]) => rows).catch(() => []),

        // 5. Tamamlanan Cihaz Bakımları
        pool.query(`
          SELECT mic.id, mic.plan_id, mic.asset_tag, mic.asset_name, mic.model_name,
                 mic.assigned_user, mic.location_name, mic.status, mic.tech_name, mic.completed_at,
                 mp.title AS plan_title, mp.company_name
          FROM maintenance_item_checks mic
          LEFT JOIN maintenance_plans mp ON mic.plan_id = mp.id
          WHERE mic.completed_at IS NOT NULL AND mic.status = 'Tamamlandı'
            AND DATE(mic.completed_at) >= ? AND DATE(mic.completed_at) <= ?
          ORDER BY mic.completed_at ASC
        `, [startDate, endDate]).then(([rows]) => rows).catch(() => []),

        // 6. Kişisel IT Notları & Hatırlatıcılar
        pool.query(`
          SELECT id, user_id, user_name, title, description, note_date, color, created_at
          FROM user_calendar_notes
          WHERE DATE(note_date) >= ? AND DATE(note_date) <= ?
          ORDER BY note_date ASC, id ASC
        `, [startDate, endDate]).then(([rows]) => rows).catch(() => [])
      ]);

      res.json({
        success: true,
        startDate,
        endDate,
        tickets,
        cargo,
        toner,
        maintenancePlans,
        maintenanceChecks,
        notes: notes || []
      });
    } catch (err) {
      dbError(res, err, 'maintenance:master-calendar');
    }
  });

  // 10. Create User Note
  app.post('/api/maintenance/notes', async (req, res) => {
    try {
      const { user_id, user_name, title, description, note_date, color } = req.body;
      if (!title || !note_date) {
        return res.status(400).json({ success: false, message: 'Başlık ve tarih zorunludur.' });
      }
      const [result] = await pool.execute(`
        INSERT INTO user_calendar_notes (user_id, user_name, title, description, note_date, color)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [user_id || null, user_name || 'IT Personeli', title, description || '', note_date, color || 'blue']);

      res.json({ success: true, id: result.insertId });
    } catch (err) {
      dbError(res, err, 'maintenance:create-note');
    }
  });

  // 11. Update User Note
  app.put('/api/maintenance/notes/:id', async (req, res) => {
    try {
      const noteId = Number(req.params.id);
      const { title, description, note_date, color } = req.body;
      if (!title || !note_date) {
        return res.status(400).json({ success: false, message: 'Başlık ve tarih zorunludur.' });
      }
      await pool.execute(`
        UPDATE user_calendar_notes
        SET title = ?, description = ?, note_date = ?, color = ?
        WHERE id = ?
      `, [title, description || '', note_date, color || 'blue', noteId]);

      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'maintenance:update-note');
    }
  });

  // 12. Delete User Note
  app.delete('/api/maintenance/notes/:id', async (req, res) => {
    try {
      const noteId = Number(req.params.id);
      await pool.execute('DELETE FROM user_calendar_notes WHERE id = ?', [noteId]);
      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'maintenance:delete-note');
    }
  });
};
