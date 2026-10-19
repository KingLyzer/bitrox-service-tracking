'use strict';

module.exports = function registerInventory(app, { pool, helpers, snipeitService }) {
  const { dbError } = helpers;

  async function resolveAllowedLocations(req) {
    const userId = req.query.user_id;
    let allowedList = null;

    if (userId) {
      try {
        const [rows] = await pool.query('SELECT role_id, allowed_locations FROM users WHERE id = ?', [userId]);
        if (rows.length > 0) {
          if (Number(rows[0].role_id) === 1) return null; // Admin has full access
          const locStr = rows[0].allowed_locations;
          if (locStr && locStr.trim() && locStr.trim().toLowerCase() !== 'all' && locStr.trim() !== 'null') {
            allowedList = locStr.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
      } catch (e) {}
    }

    if (!allowedList && req.query.allowed_locations) {
      const raw = String(req.query.allowed_locations).trim();
      if (raw && raw.toLowerCase() !== 'all' && raw !== 'null') {
        allowedList = raw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    return allowedList && allowedList.length > 0 ? allowedList : null;
  }

  // 1. Get Inventory Stats
  app.get('/api/inventory/stats', async (req, res) => {
    try {
      const allowedLocations = await resolveAllowedLocations(req);
      let whereClause = ' WHERE 1=1';
      const whereParams = [];

      if (allowedLocations) {
        whereClause += ` AND location_name IN (${allowedLocations.map(() => '?').join(',')})`;
        whereParams.push(...allowedLocations);
      }

      const [totalRow] = await pool.query(`SELECT COUNT(*) AS total FROM cached_assets${whereClause}`, whereParams);
      const [assignedRow] = await pool.query(`SELECT COUNT(*) AS assigned FROM cached_assets${whereClause} AND (assigned_to_user_id IS NOT NULL OR status_name LIKE "%Atanmış%" OR status_name LIKE "%Kullanıcı%")`, whereParams);
      const [categories] = await pool.query(`SELECT category_name, COUNT(*) AS count FROM cached_assets${whereClause} AND category_name IS NOT NULL AND category_name != "" GROUP BY category_name ORDER BY count DESC`, whereParams);
      const [locations] = await pool.query(`SELECT location_name, COUNT(*) AS count FROM cached_assets${whereClause} AND location_name IS NOT NULL AND location_name != "" GROUP BY location_name ORDER BY count DESC`, whereParams);
      const [statuses] = await pool.query(`SELECT status_name, COUNT(*) AS count FROM cached_assets${whereClause} AND status_name IS NOT NULL AND status_name != "" GROUP BY status_name ORDER BY count DESC`, whereParams);

      const total = totalRow[0]?.total || 0;
      const assigned = assignedRow[0]?.assigned || 0;
      const ready = Math.max(0, total - assigned);

      res.json({
        success: true,
        stats: {
          total,
          assigned,
          ready,
          categories,
          locations,
          statuses,
          isRestricted: !!allowedLocations,
          allowedLocations: allowedLocations || []
        }
      });
    } catch (err) {
      dbError(res, err, 'inventory:get-stats');
    }
  });

  // 2. Get All Assets
  app.get('/api/inventory/assets', async (req, res) => {
    try {
      const allowedLocations = await resolveAllowedLocations(req);
      const { category, location, status, search } = req.query;
      let sql = 'SELECT * FROM cached_assets WHERE 1=1';
      const params = [];

      if (allowedLocations) {
        sql += ` AND location_name IN (${allowedLocations.map(() => '?').join(',')})`;
        params.push(...allowedLocations);
      }

      if (category && category !== 'all') {
        sql += ' AND category_name = ?';
        params.push(category);
      }
      if (location && location !== 'all') {
        sql += ' AND location_name = ?';
        params.push(location);
      }
      if (status && status !== 'all') {
        sql += ' AND status_name = ?';
        params.push(status);
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        sql += ' AND (asset_tag LIKE ? OR name LIKE ? OR serial LIKE ? OR model_name LIKE ? OR assigned_to_user_name LIKE ? OR location_name LIKE ? OR manufacturer_name LIKE ? OR category_name LIKE ?)';
        params.push(term, term, term, term, term, term, term, term);
      }

      sql += ' ORDER BY id DESC';

      const [rows] = await pool.query(sql, params);
      res.json({
        success: true,
        count: rows.length,
        data: rows
      });
    } catch (err) {
      dbError(res, err, 'inventory:get-assets');
    }
  });

  // 3. Get Asset Detail (with live Snipe-IT details if requested)
  app.get('/api/inventory/assets/:id', async (req, res) => {
    try {
      const assetId = req.params.id;
      const [rows] = await pool.query('SELECT * FROM cached_assets WHERE id = ? OR asset_tag = ? LIMIT 1', [assetId, assetId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Demirbaş bulunamadı.' });
      }

      const asset = rows[0];
      let liveDetail = null;

      // Optional live fetch from Snipe-IT for detailed custom fields (MAC, IP, Licence, etc.)
      if (req.query.live === '1' && snipeitService) {
        try {
          const client = snipeitService.getClient();
          const liveRes = await client.get(`/hardware/${asset.id}`);
          if (liveRes.data) {
            liveDetail = liveRes.data;
          }
        } catch (e) {
          console.warn('[Inventory] Live detail fetch warning:', e.message);
        }
      }

      res.json({
        success: true,
        data: asset,
        liveDetail
      });
    } catch (err) {
      dbError(res, err, 'inventory:get-asset-detail');
    }
  });
};
