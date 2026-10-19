'use strict';

module.exports = function registerPush(app, { pool, webpush }) {
  async function handleSubscribe(req, res) {
    try {
      const { subscription, user_id, username } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ success: false, message: 'Geçersiz abonelik objesi.' });
      }

      await pool.execute(
        `INSERT INTO push_subscriptions (user_id, username, endpoint, keys_p256dh, keys_auth)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), username = VALUES(username), keys_p256dh = VALUES(keys_p256dh), keys_auth = VALUES(keys_auth), updated_at = CURRENT_TIMESTAMP`,
        [user_id || null, username || 'guest', subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      );

      res.json({ success: true, message: 'Push aboneliği kaydedildi.' });
    } catch (err) {
      console.error('[push/subscribe]', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async function handleUnsubscribe(req, res) {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async function handleTest(req, res) {
    try {
      const { username, title, body } = req.body;
      await webpush.sendWebPushNotification({
        title: title || 'Örnek Teknoloji Test Bildirimi 🔔',
        body: body || 'Arka plan Web Push bildirimleri başarıyla çalışıyor!',
        url: '/',
        targetUsers: username ? [username] : null
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  const vapidHandler = (_req, res) => {
    res.json({ success: true, publicKey: webpush.vapidKeys.publicKey });
  };

  app.get(['/api/push/vapid-key', '/push/vapid-key', '/api/db/push-vapid-key'], vapidHandler);
  app.post(['/api/push/subscribe', '/push/subscribe', '/api/db/push-subscribe'], handleSubscribe);
  app.post(['/api/push/unsubscribe', '/push/unsubscribe', '/api/db/push-unsubscribe'], handleUnsubscribe);
  app.post(['/api/push/test', '/push/test', '/api/db/push-test'], handleTest);
};
