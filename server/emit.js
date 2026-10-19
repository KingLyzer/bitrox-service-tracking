'use strict';

let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  return io;
}

function safeEmit(event, data) {
  try {
    if (io) io.emit(event, data);
  } catch (err) {
    console.error(`[Socket Emit Hatası] ${event}:`, err.message);
  }
}

function emitToRoom(room, event, data) {
  try {
    if (io) io.to(room).emit(event, data);
  } catch (err) {
    console.error(`[Socket Room Emit Hatası] ${event}:`, err.message);
  }
}

module.exports = { setIO, getIO, safeEmit, emitToRoom };
