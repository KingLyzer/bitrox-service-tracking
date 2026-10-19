'use strict';

const { Server } = require('socket.io');
const { pool } = require('./db');
const { ensureDefaultChatRoom, nowSql } = require('./helpers');
const { setIO, emitToRoom, safeEmit } = require('./emit');
const { sendWebPushNotification } = require('./webpush');

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    pingTimeout: 30000,
    pingInterval: 10000,
  });
  setIO(io);

  io.on('connection', (socket) => {
    console.log(`[Socket] Bağlandı: ${socket.id}`);

    socket.on('kullanici-frekansina-baglan', (userName) => {
      if (userName) socket.join(`user-channel-${userName}`);
    });

    socket.on('odaya-katil', async (roomId) => {
      if (!roomId) return;
      if (Number(roomId) === 1) await ensureDefaultChatRoom(pool);
      socket.join(`room-${roomId}`);
      try {
        const [messages] = await pool.execute(
          `SELECT m.*, COALESCE(u.full_name, u.username, m.sender_name) AS sender_full_name
           FROM chat_messages m
           LEFT JOIN users u ON m.sender_name = u.username
           WHERE m.room_id = ?
           ORDER BY m.id ASC LIMIT 50`,
          [roomId]
        );
        socket.emit('sohbet-gecmisi', messages);
      } catch (err) {
        console.error('[Socket sohbet-gecmisi]', err.message);
      }
    });

    socket.on('ozel-oda-bul-veya-ac', async (data = {}) => {
      const { sender_name, receiver_name } = data;
      if (!sender_name || !receiver_name) return;

      try {
        const [existing] = await pool.execute(
          `SELECT p1.room_id
           FROM chat_participants p1
           JOIN chat_participants p2 ON p1.room_id = p2.room_id
           JOIN chat_rooms r ON p1.room_id = r.id
           WHERE p1.user_name = ? AND p2.user_name = ? AND r.is_private = 1
           LIMIT 1`,
          [sender_name, receiver_name]
        );

        if (existing.length > 0) {
          const [targetRows] = await pool.execute('SELECT full_name FROM users WHERE username = ? LIMIT 1', [receiver_name]);
          const targetFullName = targetRows.length > 0 ? targetRows[0].full_name : receiver_name;
          socket.emit('ozel-oda-hazir', { room_id: existing[0].room_id, room_name: targetFullName });
          return;
        }

        const [roomRes] = await pool.execute(
          'INSERT INTO chat_rooms (room_name, room_type, is_private) VALUES (?, "private", 1)',
          [`DM-${sender_name}-${receiver_name}`]
        );
        const newRoomId = roomRes.insertId;

        await pool.execute(
          'INSERT INTO chat_participants (room_id, user_name) VALUES (?, ?), (?, ?)',
          [newRoomId, sender_name, newRoomId, receiver_name]
        );

        const [targetRows] = await pool.execute('SELECT full_name FROM users WHERE username = ? LIMIT 1', [receiver_name]);
        const targetFullName = targetRows.length > 0 ? targetRows[0].full_name : receiver_name;
        socket.emit('ozel-oda-hazir', { room_id: newRoomId, room_name: targetFullName });
        safeEmit('odalar-guncellendi');
      } catch (err) {
        console.error('[Socket ozel-oda]', err.message);
      }
    });

    socket.on('chat-mesaj-gonder', async (data = {}) => {
      const { room_id, sender_name, message_text } = data;
      if (!room_id || !message_text?.trim()) return;

      try {
        if (Number(room_id) === 1) await ensureDefaultChatRoom(pool);
        const created_at = nowSql();
        const [result] = await pool.execute(
          'INSERT INTO chat_messages (room_id, sender_name, message_text, created_at) VALUES (?, ?, ?, ?)',
          [room_id, sender_name || 'Bilinmeyen Kullanıcı', message_text.trim(), created_at]
        );

        const [userRows] = await pool.execute('SELECT full_name FROM users WHERE username = ? LIMIT 1', [sender_name]);
        const senderFullName = userRows.length > 0 ? userRows[0].full_name : sender_name;

        const savedMessage = {
          id: result.insertId,
          room_id,
          sender_name: sender_name || 'Bilinmeyen Kullanıcı',
          sender_full_name: senderFullName,
          message_text: message_text.trim(),
          created_at,
        };

        // Tek seferlik, odadaki herkese gönderim (global çift-emit kaldırıldı).
        emitToRoom(`room-${room_id}`, 'yeni-chat-mesaji', savedMessage);

        const [participants] = await pool.execute(
          'SELECT user_name FROM chat_participants WHERE room_id = ? AND user_name != ?',
          [room_id, sender_name || '']
        );
        const recipientUsers = participants.map(p => p.user_name);
        sendWebPushNotification({
          title: `💬 ${senderFullName || sender_name}`,
          body: message_text.trim(),
          url: '/',
          targetUsers: recipientUsers.length > 0 ? recipientUsers : null
        }).catch(() => {});
      } catch (err) {
        console.error('[Socket mesaj]', err.message);
      }
    });
  });

  return io;
}

module.exports = { createSocketServer };
