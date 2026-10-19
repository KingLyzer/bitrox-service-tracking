'use strict';

const webpush = require('web-push');
const { pool } = require('./db');

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BP-ne4LYoyU0VTNT85w6v6TQs2HzPske85q3KaDolQGT80Q5Ua6BdUzIN0CIcwbmcyGSSqEMCS_vH5NZ18IGw4U',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'CnQjD4aOKSZFJOJ-NPvN48LlkUsH2T_o2OQVmqLsN98',
};

try {
  const vapidMailto = process.env.VAPID_MAILTO || 'mailto:admin@example.com';
  webpush.setVapidDetails(vapidMailto, vapidKeys.publicKey, vapidKeys.privateKey);
  console.log('[WebPush] VAPID anahtarları aktif.');
} catch (err) {
  console.error('[WebPush] Kurulum hatası:', err.message);
}

async function ensurePushTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        username VARCHAR(128) NOT NULL,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_endpoint (endpoint(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.warn('[Push Table]', err.message);
  }
}

async function sendWebPushNotification({ title, body, url = '/', tag = 'service-ticket', targetUsers = null }) {
  try {
    let sql = 'SELECT * FROM push_subscriptions';
    let params = [];
    if (targetUsers && targetUsers.length > 0) {
      sql += ' WHERE username IN (' + targetUsers.map(() => '?').join(',') + ')';
      params = targetUsers;
    }
    const [subs] = await pool.execute(sql, params);
    if (!subs || !subs.length) return;

    const payload = JSON.stringify({
      title,
      body,
      url,
      tag,
      icon: '/assets/logo-BAS7192s.png'
    });

    for (const sub of subs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };
      webpush.sendNotification(pushSubscription, payload).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]).catch(() => {});
        }
      });
    }
  } catch (err) {
    console.error('[sendWebPushNotification]', err.message);
  }
}

module.exports = { vapidKeys, ensurePushTable, sendWebPushNotification };
