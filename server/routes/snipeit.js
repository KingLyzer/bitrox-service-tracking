'use strict';

module.exports = function registerSnipeit(app, { snipeitService, config, pool }) {
  const { DEFAULT_SNIPE_URL, DEFAULT_SNIPE_TOKEN } = config;

  app.post('/api/snipeit/sync', async (req, res) => {
    try {
      const force = req.body?.force === true;
      const result = await snipeitService.syncAll(force);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/snipeit/save-consumable', async (req, res) => {
    try {
      const result = await snipeitService.saveConsumable(req.body.data);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/snipeit/checkout-consumable', async (req, res) => {
    try {
      const result = await snipeitService.checkoutConsumable(req.body.data);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/snipeit/save-component', async (req, res) => {
    try {
      const result = await snipeitService.saveComponent(req.body.data);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/snipeit/sync-checkedout', async (req, res) => {
    try {
      const result = await snipeitService.syncCheckedoutHistory();
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/snipe-config', async (_req, res) => {
    let snipeUrl = process.env.SNIPE_URL || DEFAULT_SNIPE_URL;
    let snipeToken = process.env.SNIPE_TOKEN || DEFAULT_SNIPE_TOKEN;

    try {
      if (pool) {
        const [rows] = await pool.execute('SELECT `key`, `value` FROM settings WHERE `key` IN ("snipeit_url", "snipe_url", "snipeit_api_key", "snipe_token")');
        rows.forEach(r => {
          if ((r.key === 'snipeit_url' || r.key === 'snipe_url') && r.value) snipeUrl = r.value;
          if ((r.key === 'snipeit_api_key' || r.key === 'snipe_token') && r.value) snipeToken = r.value;
        });
      }
    } catch (e) {}

    if (snipeUrl && snipeUrl.startsWith('http://') && !snipeUrl.includes('localhost') && !snipeUrl.includes('127.0.0.1')) {
      snipeUrl = snipeUrl.replace('http://', 'https://');
    }

    res.json({
      success: true,
      config: {
        snipe_url: snipeUrl,
        snipeit_url: snipeUrl,
        snipe_token: snipeToken,
        snipeit_api_key: snipeToken,
      },
    });
  });
};
