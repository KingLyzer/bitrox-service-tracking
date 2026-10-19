const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, dbAll, dbGet, dbRun, dbTransaction, getDb, closeDb } = require('./db/database');
const bcrypt = require('bcryptjs');
const snipeitService = require('./services/snipeit');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;

function createWindow() {
  Menu.setApplicationMenu(null);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Servis ve Toner Takip Sistemi',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#1e1e1e', // changed to dark
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    const maximized = dbGet("SELECT value FROM settings WHERE key='window_maximized'");
    if (!maximized || maximized.value === '1') mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  try {
    initDatabase();
  } catch (err) {
    console.error('DB init failed:', err);
  }
  createWindow();
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

// ── AUTH ──────────────────────────────────────────────────
ipcMain.handle('auth:login', (_, { username, password }) => {
  try {
    const user = dbGet(
      'SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.username=? AND u.is_active=1',
      [username]
    );
    if (!user) return { success: false, message: 'Kullanıcı bulunamadı.' };
    if (!bcrypt.compareSync(password, user.password_hash)) return { success: false, message: 'Şifre hatalı.' };
    dbRun('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    dbRun('INSERT INTO audit_logs (user_id,username,action,module,description) VALUES (?,?,?,?,?)',
      [user.id, user.username, 'LOGIN', 'auth', 'Kullanıcı girişi yapıldı.']);
    const { password_hash, ...safeUser } = user;
    const perms = dbAll('SELECT * FROM permissions WHERE role_id=?', [user.role_id]);
    return { success: true, user: safeUser, permissions: perms };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('auth:change-password', (_, { userId, oldPassword, newPassword }) => {
  try {
    const user = dbGet('SELECT * FROM users WHERE id=?', [userId]);
    if (!user) return { success: false, message: 'Kullanıcı bulunamadı.' };
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) return { success: false, message: 'Mevcut şifre hatalı.' };
    const hash = bcrypt.hashSync(newPassword, 10);
    dbRun('UPDATE users SET password_hash=? WHERE id=?', [hash, userId]);
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
});

// ── GENERIC DB ────────────────────────────────────────────
ipcMain.handle('db:query', (_, { sql, params }) => {
  try { return { success: true, data: dbAll(sql, params || []) }; }
  catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:get', (_, { sql, params }) => {
  try { return { success: true, data: dbGet(sql, params || []) }; }
  catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:run', (_, { sql, params }) => {
  try {
    // Handle PLAIN: password prefix — hash before storing
    const processedParams = (params || []).map(p => {
      if (typeof p === 'string' && p.startsWith('PLAIN:')) {
        return bcrypt.hashSync(p.slice(6), 10);
      }
      return p;
    });
    const result = dbRun(sql, processedParams);
    return { success: true, lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:transaction', (_, { operations }) => {
  try {
    const results = dbTransaction(() => {
      return operations.map(op => {
        const r = dbRun(op.sql, op.params || []);
        return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
      });
    });
    return { success: true, results };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('db:test-mysql', async (_, settings) => {
  return { success: true, message: 'MySQL doğrudan sunucu bağlantısı kapatıldı (Middleware/Websocket devrede)!' };
});

const CORE_TABLES = [
  'roles', 'users', 'permissions', 'departments', 'people',
  'cached_locations', 'cached_users', 'cached_manufacturers', 'cached_models', 'cached_assets',
  'cached_companies', 'cached_suppliers', 'cached_categories',
  'device_types', 'brands', 'devices', 'service_tickets',
  'service_operations', 'stock_categories', 'stock_items',
  'stock_movements', 'used_parts', 'printer_models', 'printers',
  'toner_items', 'toner_changes', 'attachments', 'settings', 'operation_types', 'audit_logs'
];

const SERVER_SETTING_KEYS = ['db_type', 'db_host', 'db_port', 'db_user', 'db_pass', 'db_name', 'db_network_path'];

function quoteSqliteIdentifier(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function quoteMysqlIdentifier(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

async function createMysqlConnection(settings = {}) {
  const mysql = require('mysql2/promise');
  return mysql.createConnection({
    host: settings.db_host || '128.1.1.10',
    port: parseInt(settings.db_port || '3306', 10),
    user: settings.db_user || 'root',
    password: settings.db_pass || '',
    database: settings.db_name || 'servicetracker',
    connectTimeout: 5000
  });
}

async function ensureRemoteSyncMeta(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      \`key\` VARCHAR(255) PRIMARY KEY,
      \`value\` TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getRemoteDataVersion(conn) {
  await ensureRemoteSyncMeta(conn);
  const [rows] = await conn.execute("SELECT `value`, updated_at FROM sync_meta WHERE `key`='data_version' LIMIT 1");
  return rows?.[0] || null;
}

async function touchRemoteDataVersion(conn) {
  await ensureRemoteSyncMeta(conn);
  const version = String(Date.now());
  await conn.execute(
    "INSERT INTO sync_meta (`key`, `value`, updated_at) VALUES ('data_version', ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=CURRENT_TIMESTAMP",
    [version]
  );
  return version;
}

async function hasRemoteData(conn) {
  for (const table of CORE_TABLES) {
    try {
      const [rows] = await conn.execute(`SELECT 1 AS has_data FROM ${quoteMysqlIdentifier(table)} LIMIT 1`);
      if (rows?.length > 0) return true;
    } catch (err) {
      // Missing tables are expected before the first upload.
    }
  }
  return false;
}

function getLocalColumns(localDb, table) {
  try {
    return localDb.prepare(`PRAGMA table_info(${quoteSqliteIdentifier(table)})`).all();
  } catch (err) {
    return [];
  }
}

function normalizeDbValue(value) {
  if (value instanceof Date) return value.toISOString().replace('T', ' ').substring(0, 19);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) return null;
  if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) return JSON.stringify(value);
  return value;
}

ipcMain.handle('db:mysql-sync-state', async (_, settings) => {
  return {
    success: true,
    version: String(Date.now()),
    updated_at: new Date()
  };
});

ipcMain.handle('db:pull-mysql', async (_, settings) => {
  return {
    success: true,
    message: 'Doğrudan MySQL bağlantısı kapatıldı. Veriler middleware üzerinden çekilmektedir.',
    version: null,
    results: {}
  };
});

ipcMain.handle('db:push-mysql', async (_, settings) => {
  return {
    success: true,
    message: 'Doğrudan MySQL bağlantısı kapatıldı. Veriler middleware üzerinden gönderilmektedir.',
    version: null,
    results: {}
  };
});

// ── TICKET NO / CODE GENERATOR ────────────────────────────
ipcMain.handle('util:generate-ticket-no', () => {
  try {
    const prefix = (dbGet("SELECT value FROM settings WHERE key='ticket_prefix'") || {}).value || 'SRV';
    const year = new Date().getFullYear();
    const last = dbGet(
      'SELECT ticket_no FROM service_tickets WHERE ticket_no LIKE ? ORDER BY id DESC LIMIT 1',
      [`${prefix}-${year}-%`]
    );
    let seq = 1;
    if (last) {
      const parts = last.ticket_no.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      seq = Number.isFinite(parsed) ? parsed + 1 : 1;
    }
    return { success: true, value: `${prefix}-${year}-${String(seq).padStart(3, '0')}` };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:generate-code', (_, { type }) => {
  try {
    const keyMap = { device: 'device_prefix', stock: 'stock_prefix', toner: 'toner_prefix' };
    const tableMap = { device: 'devices', stock: 'stock_items', toner: 'toner_items' };
    const colMap = { device: 'device_code', stock: 'stock_code', toner: 'toner_code' };
    if (!keyMap[type] || !tableMap[type] || !colMap[type]) {
      return { success: false, message: 'Geçersiz kod türü.' };
    }
    const prefix = (dbGet(`SELECT value FROM settings WHERE key='${keyMap[type]}'`) || {}).value || type.toUpperCase().slice(0, 3);
    const col = colMap[type];
    const table = tableMap[type];
    const last = dbGet(`SELECT ${col} FROM ${table} ORDER BY id DESC LIMIT 1`);
    let seq = 1;
    if (last && last[col]) {
      const parts = last[col].split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      seq = Number.isFinite(parsed) ? parsed + 1 : 1;
    }
    return { success: true, value: `${prefix}-${String(seq).padStart(4, '0')}` };
  } catch (err) { return { success: false, message: err.message }; }
});

// ── BACKUP ────────────────────────────────────────────────
ipcMain.handle('backup:manual', async (_, { targetDir }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'servicetracker.db');
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(targetDir, `servicetracker_backup_${now}.db`);
    fs.copyFileSync(dbPath, dest);
    dbRun('INSERT INTO audit_logs (action,module,description) VALUES (?,?,?)',
      ['BACKUP', 'system', `Yedekleme alındı: ${dest}`]);
    return { success: true, path: dest };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('backup:restore', async (_, { sourcePath }) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'servicetracker.db');
    closeDb();
    fs.copyFileSync(sourcePath, dbPath);
    initDatabase();
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('backup:choose-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return { success: false };
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('backup:choose-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (result.canceled) return { success: false };
  return { success: true, path: result.filePaths[0] };
});

// ── ATTACHMENTS ───────────────────────────────────────────
ipcMain.handle('attachment:add', async (_, { refType, refId, userId }) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Dosyalar', extensions: ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx', 'txt'] }]
    });
    if (result.canceled) return { success: false };
    const attachDir = path.join(app.getPath('userData'), 'attachments', refType, String(refId));
    fs.mkdirSync(attachDir, { recursive: true });
    const saved = [];
    for (const filePath of result.filePaths) {
      const fname = path.basename(filePath);
      const dest = path.join(attachDir, `${Date.now()}_${fname}`);
      fs.copyFileSync(filePath, dest);
      const r = dbRun(
        'INSERT INTO attachments (ref_type,ref_id,file_name,file_path,uploaded_by) VALUES (?,?,?,?,?)',
        [refType, refId, fname, dest, userId]
      );
      saved.push({ id: r.lastInsertRowid, file_name: fname, file_path: dest });
    }
    return { success: true, files: saved };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('attachment:open', (_, { filePath }) => {
  shell.openPath(filePath);
  return { success: true };
});

ipcMain.handle('attachment:delete', (_, { id }) => {
  try {
    const att = dbGet('SELECT * FROM attachments WHERE id=?', [id]);
    if (att && fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path);
    dbRun('DELETE FROM attachments WHERE id=?', [id]);
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
});

// ── PRINT / EXPORT ────────────────────────────────────────
ipcMain.handle('util:print', async () => {
  try {
    await mainWindow.webContents.print({ silent: false, printBackground: true });
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:save-pdf', async (_, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'rapor.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return { success: false };
  try {
    const data = await mainWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(result.filePath, data);
    shell.openPath(result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:save-excel', async (_, { defaultName, buffer }) => {
  const ext = path.extname(defaultName || '').toLowerCase();
  const filters = ext === '.csv'
    ? [{ name: 'CSV', extensions: ['csv'] }]
    : [{ name: 'Excel', extensions: ['xlsx'] }, { name: 'CSV', extensions: ['csv'] }];
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'rapor.xlsx',
    filters
  });
  if (result.canceled) return { success: false };
  try {
    fs.writeFileSync(result.filePath, Buffer.from(buffer));
    shell.openPath(result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('util:get-app-path', () => {
  return { success: true, path: app.getPath('userData') };
});

// ── SNIPE-IT ──────────────────────────────────────────────
ipcMain.handle('snipeit:sync', async () => {
  return await snipeitService.syncAll();
});

ipcMain.handle('snipeit:save-consumable', async (_, { data }) => {
  return await snipeitService.saveConsumable(data);
});

ipcMain.handle('snipeit:checkout-consumable', async (_, { data }) => {
  return await snipeitService.checkoutConsumable(data);
});

ipcMain.handle('snipeit:save-component', async (_, { data }) => {
  return await snipeitService.saveComponent(data);
});
