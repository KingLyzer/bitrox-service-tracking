'use strict';

module.exports = function registerChat(app, { pool, helpers }) {
  const { ensureDefaultChatRoom } = helpers;

  app.get('/api/chat/rooms', async (req, res) => {
    try {
      await ensureDefaultChatRoom(pool);
      const { user_name } = req.query;
      let query = 'SELECT * FROM chat_rooms WHERE is_private = 0';
      let params = [];

      if (user_name) {
        query = `
          SELECT r.id, r.room_type, r.is_private, r.created_at,
                 COALESCE(
                   (SELECT COALESCE(u.full_name, u.username) FROM chat_participants p JOIN users u ON p.user_name = u.username WHERE p.room_id = r.id AND p.user_name != ? LIMIT 1),
                   r.room_name
                 ) AS room_name
           FROM chat_rooms r
           LEFT JOIN chat_participants cp ON r.id = cp.room_id
           WHERE r.is_private = 0 OR (
             r.is_private = 1 AND cp.user_name = ? AND EXISTS (
               SELECT 1 FROM chat_participants p2
               JOIN users u ON p2.user_name = u.username
               WHERE p2.room_id = r.id AND p2.user_name != ? AND COALESCE(u.is_active, 1) = 1
             )
           )
           GROUP BY r.id, r.room_type, r.is_private, r.created_at, r.room_name
           ORDER BY r.id ASC
        `;
        params = [user_name, user_name, user_name];
      }

      const [rooms] = await pool.execute(query, params);
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
};
