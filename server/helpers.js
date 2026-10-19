'use strict';

const bcrypt = require('bcryptjs');

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function cleanText(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function normalizeTicket(row) {
  const serviceOperations = Array.isArray(row.service_operations) ? row.service_operations : [];
  const usedParts = Array.isArray(row.used_parts) ? row.used_parts : [];

  return {
    ...row,
    model: row.model_name || row.asset_name || row.model || null,
    urun: row.asset_name || row.model_name || row.urun || null,
    location: row.location_name || row.location || null,
    asset_no: row.asset_tag || row.asset_no || null,
    service_operations: serviceOperations,
    operations: serviceOperations,
    logs: serviceOperations,
    actions: serviceOperations,
    used_parts: usedParts,
    parts: usedParts,
  };
}

async function tableHasColumn(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function verifyPassword(inputPassword, storedHash) {
  if (!storedHash) return false;
  if (bcrypt && /^\$2[aby]\$/.test(String(storedHash))) {
    return bcrypt.compareSync(String(inputPassword || ''), storedHash);
  }
  return String(inputPassword || '') === String(storedHash);
}

async function insertAuditLog(conn, entry) {
  try {
    const username = entry.user?.username || entry.user?.full_name || 'system';
    const oldVal = entry.oldValue ? JSON.stringify(entry.oldValue) : null;
    const newVal = entry.newValue ? JSON.stringify(entry.newValue) : null;
    const created_at = nowSql();
    await conn.execute(
      'INSERT INTO audit_logs (username, action, module, ref_id, description, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, entry.action, entry.module, entry.refId || null, entry.description || '', oldVal, newVal, created_at]
    );
  } catch (e) {
    console.error('[insertAuditLog] error:', e.message);
  }
}

async function ensureDefaultChatRoom(conn) {
  try {
    const [existing] = await conn.execute(
      'SELECT id FROM chat_rooms WHERE id = 1 OR room_name = ? ORDER BY id ASC LIMIT 1',
      ['#genel-it']
    );
    if (existing.length > 0) return existing[0].id;

    const [result] = await conn.execute(
      'INSERT INTO chat_rooms (room_name, room_type, is_private) VALUES (?, ?, 0)',
      ['#genel-it', 'group']
    );
    return result.insertId;
  } catch (err) {
    console.error('[Chat varsayılan oda]', err.message);
    return 1;
  }
}

// Table list used by the socket refresh event detector (word-boundary match).
const WATCHED_TABLES = [
  'toner_items',
  'toner_changes',
  'stock_items',
  'stock_categories',
  'stock_movements',
  'service_tickets',
  'service_operations',
  'used_parts',
  'users',
  'cached_users',
  'cached_assets',
  'cached_locations',
  'cached_companies',
  'cached_suppliers',
  'cached_manufacturers',
  'cached_categories',
  'settings',
  'announcements',
  'installation_templates',
  'installation_template_tasks',
  'installation_tasks',
];

function detectTableChanges(sql) {
  const clean = String(sql || '');
  const tables = [];
  for (const t of WATCHED_TABLES) {
    const re = new RegExp(`(^|[^a-z0-9_])${t}([^a-z0-9_]|$)`);
    if (re.test(clean)) tables.push(t);
  }
  return tables;
}

/**
 * Allocates the next ticket number from the `sequences` table.
 * NOTE: caller is responsible for the surrounding transaction (begin/commit/rollback).
 */
async function generateTicketNo(conn) {
  const prefix = 'SRV';
  const year = new Date().getFullYear();
  const sequenceName = `ticket_${year}`;

  const [seqRows] = await conn.execute(
    'SELECT val FROM sequences WHERE name = ? FOR UPDATE',
    [sequenceName]
  ).catch(() => [[]]);

  let nextVal = 1;
  if (!seqRows || seqRows.length === 0) {
    const [maxRows] = await conn.execute(
      'SELECT ticket_no FROM service_tickets WHERE ticket_no LIKE ?',
      [`${prefix}-${year}-%`]
    );
    let maxSeq = 0;
    for (const row of maxRows) {
      const parsed = parseInt(String(row.ticket_no || '').split('-').pop(), 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
    nextVal = maxSeq + 1;
    await conn.execute(
      'INSERT INTO sequences (name, val) VALUES (?, ?)',
      [sequenceName, nextVal]
    ).catch(() => {});
  } else {
    nextVal = Number(seqRows[0].val || 0) + 1;
    await conn.execute('UPDATE sequences SET val = ? WHERE name = ?', [nextVal, sequenceName]);
  }

  return `${prefix}-${year}-${String(nextVal).padStart(3, '0')}`;
}

/** Uniform DB-error response: logs the real error, returns a safe client message. */
function dbError(res, err, tag = 'db') {
  console.error(`[${tag}]`, err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  res.status(500).json({ success: false, message: 'Veritabanı hatası oluştu.' });
}

module.exports = {
  nowSql,
  cleanText,
  normalizeTicket,
  tableHasColumn,
  verifyPassword,
  insertAuditLog,
  ensureDefaultChatRoom,
  detectTableChanges,
  generateTicketNo,
  dbError,
};
