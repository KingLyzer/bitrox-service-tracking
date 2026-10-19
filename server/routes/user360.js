'use strict';

module.exports = function registerUser360(app, ctx) {
  const { pool, helpers } = ctx;
  const { dbError } = helpers || {};

  /**
   * GET /api/user360/search?q=...
   * Global Smart Search: searches users, devices/assets, and ticket numbers
   */
  app.get('/api/user360/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q || q.length < 2) {
        return res.json({ success: true, results: [] });
      }

      const term = `%${q}%`;
      const isNum = /^\d+$/.test(q);

      // 1. Search in cached_users
      const [users] = await pool.query(
        `SELECT cu.id, cu.name, cu.username, cu.email, cu.department_name, cu.location_name, u.phone, u.avatar
         FROM cached_users cu
         LEFT JOIN users u ON (LOWER(u.username) = LOWER(cu.username) OR LOWER(u.email) = LOWER(cu.email))
         WHERE cu.name LIKE ? OR cu.username LIKE ? OR cu.email LIKE ? ${isNum ? 'OR cu.id = ' + Number(q) : ''}
         ORDER BY cu.name ASC
         LIMIT 10`,
        [term, term, term]
      );

      // 2. Search in cached_assets to find the owner user
      const [assets] = await pool.query(
        `SELECT ca.id AS asset_id, ca.name AS asset_name, ca.asset_tag, ca.serial,
                ca.assigned_to_user_id, ca.assigned_to_user_name,
                cu.id AS user_id, cu.name AS user_name, cu.username, cu.email,
                cu.department_name, cu.location_name
         FROM cached_assets ca
         LEFT JOIN cached_users cu ON ca.assigned_to_user_id = cu.id
         WHERE (ca.asset_tag LIKE ? OR ca.serial LIKE ? OR ca.name LIKE ?)
           AND (ca.assigned_to_user_id IS NOT NULL OR ca.assigned_to_user_name IS NOT NULL)
         LIMIT 6`,
        [term, term, term]
      );

      // 3. Search in service_tickets to find the affected user
      const [tickets] = await pool.query(
        `SELECT st.id AS ticket_id, st.ticket_no, st.user_id, st.user_name, st.asset_name,
                cu.id AS user_cu_id, cu.name AS user_cu_name, cu.username, cu.email,
                cu.department_name, cu.location_name
         FROM service_tickets st
         LEFT JOIN cached_users cu ON (st.user_id = cu.id OR LOWER(st.user_name) = LOWER(cu.name))
         WHERE st.ticket_no LIKE ? OR st.asset_name LIKE ?
         LIMIT 6`,
        [term, term]
      );

      // Merge and consolidate results
      const resultsMap = new Map();

      // Add direct user matches
      for (const u of users) {
        resultsMap.set(String(u.id), {
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          phone: u.phone,
          avatar: u.avatar,
          department_name: u.department_name,
          location_name: u.location_name,
          match_type: 'user',
          match_badge: 'Personel',
          match_highlight: u.name,
          match_info: `${u.department_name || 'Birim yok'} • ${u.location_name || 'Lokasyon yok'}`
        });
      }

      // Add asset owner matches
      for (const a of assets) {
        const uId = a.user_id || a.assigned_to_user_id;
        const uName = a.user_name || a.assigned_to_user_name;
        if (!uId && !uName) continue;

        const key = uId ? String(uId) : `name_${uName}`;
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            id: uId || null,
            name: uName,
            username: a.username || '',
            email: a.email || '',
            department_name: a.department_name,
            location_name: a.location_name,
            match_type: 'asset',
            match_badge: 'Zimmetli Cihaz',
            match_highlight: `${a.asset_name || a.asset_tag} (${a.asset_tag || a.serial || ''})`,
            match_info: `Kullanıcı: ${uName}`
          });
        }
      }

      // Add ticket user matches
      for (const t of tickets) {
        const uId = t.user_cu_id || t.user_id;
        const uName = t.user_cu_name || t.user_name;
        if (!uId && !uName) continue;

        const key = uId ? String(uId) : `name_${uName}`;
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            id: uId || null,
            name: uName,
            username: t.username || '',
            email: t.email || '',
            department_name: t.department_name,
            location_name: t.location_name,
            match_type: 'ticket',
            match_badge: 'Servis Fişi',
            match_highlight: `${t.ticket_no} - ${t.asset_name || 'Cihaz'}`,
            match_info: `Kullanıcı: ${uName}`
          });
        }
      }

      const results = Array.from(resultsMap.values()).slice(0, 12);
      res.json({ success: true, results });
    } catch (err) {
      console.error('[user360:search]', err);
      res.status(500).json({ success: false, message: err.message, results: [] });
    }
  });

  /**
   * GET /api/user360/profile
   * GET /api/user360/:id
   * Complete 360-degree aggregated profile for a single user
   */
  const handleGetProfile = async (req, res) => {
    try {
      const idParam = req.params.id || req.query.id;
      const nameParam = req.query.name;
      const usernameParam = req.query.username;

      if (!idParam && !nameParam && !usernameParam) {
        return res.status(400).json({ success: false, message: 'Kullanıcı kimliği veya adı belirtilmelidir.' });
      }

      // 1. Fetch User Information
      let user = null;
      if (idParam && Number(idParam)) {
        const [uRows] = await pool.query(
          `SELECT cu.*, u.phone, u.avatar, u.is_active AS system_user_active
           FROM cached_users cu
           LEFT JOIN users u ON (LOWER(u.username) = LOWER(cu.username) OR LOWER(u.email) = LOWER(cu.email))
           WHERE cu.id = ? LIMIT 1`,
          [Number(idParam)]
        );
        user = uRows[0] || null;
      }

      if (!user && (nameParam || usernameParam)) {
        const [uRows] = await pool.query(
          `SELECT cu.*, u.phone, u.avatar, u.is_active AS system_user_active
           FROM cached_users cu
           LEFT JOIN users u ON (LOWER(u.username) = LOWER(cu.username) OR LOWER(u.email) = LOWER(cu.email))
           WHERE LOWER(cu.name) = LOWER(?) OR LOWER(cu.username) = LOWER(?) LIMIT 1`,
          [nameParam || '', usernameParam || '']
        );
        user = uRows[0] || null;
      }

      if (!user) {
        // Fallback: check users table directly
        const [sysRows] = await pool.query(
          `SELECT id, username, full_name AS name, email, phone, avatar, created_at
           FROM users
           WHERE id = ? OR LOWER(full_name) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1`,
          [Number(idParam) || 0, nameParam || '', usernameParam || '']
        );
        if (sysRows[0]) {
          user = {
            ...sysRows[0],
            department_name: 'Bilgi İşlem',
            location_name: 'Merkez',
          };
        }
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
      }

      const userId = user.id;
      const userName = user.name;

      // Run parallel sub-queries for high performance
      const [
        assetsResult,
        ticketsResult,
        tonersResult,
        cargosResult,
        bitlockersResult
      ] = await Promise.all([
        // A. Zimmetli Cihazlar (cached_assets)
        pool.query(
          `SELECT id, name, asset_tag, serial, model_name, category_name, status_name, updated_at
           FROM cached_assets
           WHERE assigned_to_user_id = ? OR LOWER(assigned_to_user_name) = LOWER(?)
           ORDER BY name ASC`,
          [userId, userName]
        ).catch(() => [[]]),

        // B. Servis Geçmişi (service_tickets)
        pool.query(
          `SELECT id, ticket_no, asset_name, asset_tag, model_name, category_name,
                  fault_desc, priority, status, created_at, updated_at, delivery_date, closed_at, notes
           FROM service_tickets
           WHERE user_id = ? OR LOWER(user_name) = LOWER(?)
           ORDER BY created_at DESC
           LIMIT 100`,
          [userId, userName]
        ).catch(() => [[]]),

        // C. Toner Geçmişi (toner_changes)
        pool.query(
          `SELECT tc.id, tc.asset_name, tc.change_date, tc.qty, tc.notes, tc.created_at,
                  ti.toner_model, ti.color, ti.category_name, ti.toner_code
           FROM toner_changes tc
           LEFT JOIN toner_items ti ON tc.toner_id = ti.id
           WHERE tc.assigned_user_id = ? OR LOWER(tc.assigned_user_name) = LOWER(?)
           ORDER BY COALESCE(tc.change_date, tc.created_at) DESC, tc.id DESC
           LIMIT 100`,
          [userId, userName]
        ).catch(() => [[]]),

        // D. Kargo & Teslimat Geçmişi (cargo_shipments)
        pool.query(
          `SELECT id, direction, status, tracking_number, waybill_no, carrier,
                  carrier_tracking_url, sender, recipient_name, received_date,
                  package_type, notes
           FROM cargo_shipments
           WHERE recipient_id = ? OR LOWER(recipient_name) = LOWER(?) OR LOWER(sender) = LOWER(?)
           ORDER BY received_date DESC, id DESC
           LIMIT 100`,
          [userId, userName, userName]
        ).catch(() => [[]]),

        // E. Güvenlik & BitLocker (bitlocker_keys)
        pool.query(
          `SELECT id, full_name, device_name, identifier, recovery_key, uploaded_at, updated_at
           FROM bitlocker_keys
           WHERE (
             LOWER(full_name) = LOWER(?)
             OR UPPER(full_name) = UPPER(?)
             OR full_name LIKE ?
             OR full_name LIKE ?
             OR device_name IN (
               SELECT name FROM cached_assets WHERE assigned_to_user_id = ? OR LOWER(assigned_to_user_name) = LOWER(?)
             )
           ) AND deleted_at IS NULL
           ORDER BY COALESCE(updated_at, uploaded_at) DESC, id DESC
           LIMIT 20`,
          [userName, userName, `%${userName}%`, `%${userName.split(' ')[0]}%`, userId, userName]
        ).catch(() => [[]])
      ]);

      const assets = assetsResult[0] || [];
      let tickets = ticketsResult[0] || [];
      const toners = tonersResult[0] || [];
      const cargos = cargosResult[0] || [];
      const bitlockers = bitlockersResult[0] || [];

      // Attach operations and used_parts to tickets if tickets exist
      if (tickets.length > 0) {
        try {
          const ticketIds = tickets.map(t => t.id);
          const placeholders = ticketIds.map(() => '?').join(',');
          const [opsRows, partsRows] = await Promise.all([
            pool.query(`
              SELECT op.*, u.full_name AS tech_name, u.username AS tech_username
              FROM service_operations op
              LEFT JOIN users u ON op.user_id = u.id
              WHERE op.ticket_id IN (${placeholders})
              ORDER BY COALESCE(op.op_date, op.created_at) DESC, op.id DESC
            `, ticketIds).catch(() => [[]]),
            pool.query(`
              SELECT * FROM used_parts WHERE ticket_id IN (${placeholders}) ORDER BY id DESC
            `, ticketIds).catch(() => [[]])
          ]);

          const opsMap = new Map();
          for (const op of (opsRows[0] || [])) {
            const k = String(op.ticket_id);
            if (!opsMap.has(k)) opsMap.set(k, []);
            opsMap.get(k).push({
              ...op,
              action_type: op.action_type || op.op_type,
              islem: op.islem || op.op_type,
              teknisyen: op.teknisyen || op.tech_name || 'Bilinmeyen Teknisyen',
            });
          }

          const partsMap = new Map();
          for (const p of (partsRows[0] || [])) {
            const k = String(p.ticket_id);
            if (!partsMap.has(k)) partsMap.set(k, []);
            partsMap.get(k).push({
              ...p,
              parca: p.parca || p.part_name,
              miktar: p.miktar || p.qty,
              tutar: p.tutar || p.total_price,
            });
          }

          tickets = tickets.map(t => ({
            ...t,
            model: t.model_name || t.asset_name || null,
            urun: t.asset_name || t.model_name || null,
            location: t.location_name || null,
            asset_no: t.asset_tag || null,
            operations: opsMap.get(String(t.id)) || [],
            service_operations: opsMap.get(String(t.id)) || [],
            used_parts: partsMap.get(String(t.id)) || [],
            parts: partsMap.get(String(t.id)) || [],
          }));
        } catch (subErr) {
          console.warn('[user360] could not attach ticket operations/parts:', subErr.message);
        }
      }

      // Calculate statistics
      const closedStatuses = ['Teslim Edildi', 'İptal', 'Kapandı', 'Çözüldü'];
      const openTicketsCount = tickets.filter(t => !closedStatuses.includes(t.status)).length;
      const totalTonerQty = toners.reduce((acc, item) => acc + (Number(item.qty) || 1), 0);

      const stats = {
        total_assets: assets.length,
        open_tickets: openTicketsCount,
        total_tickets: tickets.length,
        total_toners: totalTonerQty,
        total_cargos: cargos.length,
        has_bitlocker: bitlockers.length > 0,
        bitlocker_count: bitlockers.length,
      };

      res.json({
        success: true,
        user,
        assets,
        tickets,
        toners,
        cargos,
        bitlockers,
        stats
      });
    } catch (err) {
      console.error('[user360:profile]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.get('/api/user360/profile', handleGetProfile);
  app.get('/api/user360/:id', handleGetProfile);
};
