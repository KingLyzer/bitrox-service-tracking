'use strict';

module.exports = function registerAnnouncements(app, { pool, emit, helpers }) {
  const { dbError } = helpers;

  app.post('/api/announcements/get-all', async (_req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY id DESC');
      res.json({ success: true, data: rows });
    } catch (err) {
      dbError(res, err, 'announcements:get-all');
    }
  });

  app.post('/api/announcements/save', async (req, res) => {
    let conn;
    try {
      const { id, title, content, target_roles, target_users, frequency, daily_time, start_date, end_date, is_active } = req.body;
      conn = await pool.getConnection();
      await conn.beginTransaction();

      let result;
      const finalStartDate = start_date || null;
      const finalEndDate = end_date || null;
      const finalDailyTime = daily_time || null;

      if (id) {
        await conn.execute(
          'UPDATE announcements SET title=?, content=?, target_roles=?, target_users=?, frequency=?, daily_time=?, start_date=?, end_date=?, is_active=? WHERE id=?',
          [title, content, target_roles || 'all', target_users || null, frequency || 'once', finalDailyTime, finalStartDate, finalEndDate, is_active ?? 1, id]
        );
        result = { lastInsertRowid: id, insertId: id };
      } else {
        const [r] = await conn.execute(
          'INSERT INTO announcements (title, content, target_roles, target_users, frequency, daily_time, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [title, content, target_roles || 'all', target_users || null, frequency || 'once', finalDailyTime, finalStartDate, finalEndDate, is_active ?? 1]
        );
        result = { lastInsertRowid: r.insertId, insertId: r.insertId };
      }

      await conn.commit();

      emit.safeEmit('yeni-duyuru', {
        id: result.insertId,
        title,
        content,
        target_roles: target_roles || 'all',
        target_users: target_users || null,
        frequency: frequency || 'once',
        daily_time: finalDailyTime,
        start_date: finalStartDate,
        end_date: finalEndDate,
        is_active: is_active ?? 1
      });

      res.json({ success: true, ...result });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      res.json({ success: false, message: err.message });
    } finally {
      if (conn) conn.release();
    }
  });

  app.post('/api/announcements/delete', async (req, res) => {
    try {
      const { id } = req.body;
      await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'announcements:delete');
    }
  });

  app.post('/api/announcements/get-active', async (req, res) => {
    try {
      const { username, role_name } = req.body;
      if (!username) {
        return res.json({ success: false, message: 'username required' });
      }

      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
      const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false, hour: '2-digit', minute: '2-digit' });

      const [announcements] = await pool.execute(
        `SELECT * FROM announcements
         WHERE is_active = 1
           AND (start_date IS NULL OR start_date <= ?)
           AND (end_date IS NULL OR end_date >= ?)`,
        [todayStr, todayStr]
      );

      const filtered = announcements.filter(ann => {
        if (ann.target_roles !== 'all') {
          const roles = ann.target_roles.split(',').map(r => r.trim().toLowerCase());
          if (!roles.includes(String(role_name || '').toLowerCase())) {
            return false;
          }
        }

        if (ann.target_users) {
          const users = ann.target_users.split(',').map(u => u.trim().toLowerCase());
          if (!users.includes(String(username).toLowerCase())) {
            return false;
          }
        }

        return true;
      });

      if (filtered.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const activeAnnouncements = [];

      for (const ann of filtered) {
        if (ann.frequency === 'always') {
          activeAnnouncements.push(ann);
        } else if (ann.frequency === 'once') {
          const [reads] = await pool.execute(
            'SELECT id FROM announcement_reads WHERE announcement_id = ? AND username = ?',
            [ann.id, username]
          );
          if (reads.length === 0) {
            activeAnnouncements.push(ann);
          }
        } else if (ann.frequency === 'daily') {
          const rawTimes = (ann.daily_time || '')
            .split(',')
            .map(t => t.trim().slice(0, 5))
            .filter(t => /^\d{1,2}:\d{2}$/.test(t))
            .map(t => t.padStart(5, '0'));

          if (rawTimes.length > 0) {
            const passedTimes = rawTimes.filter(t => t <= nowTimeStr);
            if (passedTimes.length === 0) {
              // Henüz bugün için belirlenen saatlerden hiçbiri gelmedi
              continue;
            }
            passedTimes.sort();
            const latestPassedTime = passedTimes[passedTimes.length - 1];

            const [reads] = await pool.execute(
              `SELECT read_at FROM announcement_reads
               WHERE announcement_id = ? AND username = ?`,
              [ann.id, username]
            );

            if (reads.length === 0) {
              activeAnnouncements.push(ann);
            } else {
              const lastReadDateStr = new Date(reads[0].read_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
              if (lastReadDateStr < todayStr) {
                // Son okuma önceki gün yapılmış, bugün yeni bildirim saati geldi
                activeAnnouncements.push(ann);
              } else {
                // Bugün okuma yapılmış, son okuma saati en son tetiklenen saatten önce mi?
                const lastReadTimeStr = new Date(reads[0].read_at).toLocaleTimeString('tr-TR', {
                  timeZone: 'Europe/Istanbul',
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit'
                });
                if (lastReadTimeStr < latestPassedTime) {
                  activeAnnouncements.push(ann);
                }
              }
            }
          } else {
            const [readsToday] = await pool.execute(
              `SELECT id FROM announcement_reads
               WHERE announcement_id = ? AND username = ?
                 AND DATE(read_at) = ?`,
              [ann.id, username, todayStr]
            );
            if (readsToday.length === 0) {
              activeAnnouncements.push(ann);
            }
          }
        }
      }

      res.json({ success: true, data: activeAnnouncements });
    } catch (err) {
      dbError(res, err, 'announcements:get-active');
    }
  });

  app.post('/api/announcements/mark-read', async (req, res) => {
    try {
      const { announcement_id, username } = req.body;
      if (!announcement_id || !username) {
        return res.json({ success: false, message: 'announcement_id and username required' });
      }

      await pool.execute(
        `INSERT INTO announcement_reads (announcement_id, username, read_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE read_at = NOW()`,
        [announcement_id, username]
      );

      res.json({ success: true });
    } catch (err) {
      dbError(res, err, 'announcements:mark-read');
    }
  });
};
