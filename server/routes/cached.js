'use strict';

module.exports = function registerCached(app, { pool, helpers }) {
  const { dbError } = helpers;

  // Users; ?with_location=1 adds a left-join to locations for the address label module.
  app.get(['/api/cached/users', '/api/users/cached'], async (req, res) => {
    try {
      const withLocation = req.query.with_location === '1' || req.query.with_location === 'true';
      const sql = withLocation
        ? `SELECT u.*, l.name AS location_full_name
           FROM cached_users u
           LEFT JOIN cached_locations l ON u.location_id = l.id
           ORDER BY u.name ASC`
        : 'SELECT * FROM cached_users ORDER BY name ASC';
      const [rows] = await pool.query(sql);
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:users');
    }
  });

  // Asset counts per user id
  app.get('/api/cached/users/asset-counts', async (_req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT assigned_to_user_id, COUNT(*) AS count FROM cached_assets WHERE assigned_to_user_id IS NOT NULL GROUP BY assigned_to_user_id'
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:asset-counts');
    }
  });

  // Assets; optional ?assigned_to_user_id=
  app.get('/api/cached/assets', async (req, res) => {
    try {
      const userId = req.query.assigned_to_user_id;
      if (userId) {
        const [rows] = await pool.query(
          'SELECT * FROM cached_assets WHERE assigned_to_user_id = ? ORDER BY name ASC',
          [userId]
        );
        return res.json({ success: true, data: rows });
      }
      const [rows] = await pool.query('SELECT * FROM cached_assets ORDER BY asset_tag ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:assets');
    }
  });

  app.get('/api/cached/locations', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM cached_locations ORDER BY name ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:locations');
    }
  });

  app.get('/api/cached/companies', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM cached_companies ORDER BY name ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:companies');
    }
  });

  app.get('/api/cached/suppliers', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM cached_suppliers ORDER BY name ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:suppliers');
    }
  });

  app.get('/api/cached/manufacturers', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM cached_manufacturers ORDER BY name ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:manufacturers');
    }
  });

  app.get('/api/cached/categories', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM cached_categories ORDER BY name ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'cached:categories');
    }
  });
};
