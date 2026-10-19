'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const fsSync = require('fs');
const path = require('path');

// ── Directories ─────────────────────────────────────────────
const filesDir = path.join(__dirname, 'files');
if (!fsSync.existsSync(filesDir)) {
  fsSync.mkdirSync(filesDir, { recursive: true });
}

const UPDATE_DIR = process.env.UPDATE_DIR || path.join(__dirname, 'updates');
if (!fsSync.existsSync(UPDATE_DIR)) {
  fsSync.mkdirSync(UPDATE_DIR, { recursive: true });
}

const PORT = Number(process.env.PORT || 9999);

// ── Core dependencies ───────────────────────────────────────
const { pool } = require('./db');
const helpers = require('./helpers');
const emit = require('./emit');
const webpush = require('./webpush');
const { createSocketServer } = require('./socket');

const SnipeITService = require('./services/snipeit');
const snipeitService = new SnipeITService(pool);

let compression;
try {
  compression = require('compression');
} catch (e) {
  compression = null;
}

const app = express();
const server = http.createServer(app);

if (compression) {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6,
  }));
}

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/updates', express.static(UPDATE_DIR));
app.use('/files', express.static(filesDir));

// ── Socket.IO ───────────────────────────────────────────────
createSocketServer(server);

// ── Shared context passed to route modules ──────────────────
const ctx = {
  pool,
  helpers,
  emit,
  webpush,
  snipeitService,
  config: {
    filesDir,
    UPDATE_DIR,
    DEFAULT_SNIPE_URL: process.env.SNIPE_URL || '',
    DEFAULT_SNIPE_TOKEN: process.env.SNIPE_API_KEY || process.env.SNIPE_TOKEN || '',
  },
};

// ── Health ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

// ── Update manifest (web mode: metadata only) ───────────────
app.get('/api/update/latest', async (req, res) => {
  try {
    const fs = require('fs/promises');
    const manifestPath = path.join(UPDATE_DIR, 'latest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    const platform = req.query.platform || process.platform;
    const arch = req.query.arch || process.arch;
    const platformKey = `${platform}-${arch}`;
    const selectedPackage = manifest.packages?.[platformKey] || null;

    const makeAbsoluteUrl = (url) => {
      if (!url || /^https?:\/\//i.test(url)) return url;
      const origin = `${req.protocol}://${req.get('host')}`;
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    res.json({
      ...manifest,
      package: selectedPackage
        ? { ...selectedPackage, url: makeAbsoluteUrl(selectedPackage.url) }
        : null,
    });
  } catch (err) {
    res.status(404).json({
      success: false,
      message: `Güncelleme manifesti okunamadı: ${err.message}`,
    });
  }
});

// ── Route modules ───────────────────────────────────────────
require('./routes/auth')(app, ctx);
require('./routes/announcements')(app, ctx);
require('./routes/db')(app, ctx);
require('./routes/service')(app, ctx);
require('./routes/installation')(app, ctx);
require('./routes/files')(app, ctx);
require('./routes/settings')(app, ctx);
require('./routes/cached')(app, ctx);
require('./routes/stock')(app, ctx);
require('./routes/toner')(app, ctx);
require('./routes/push')(app, ctx);
require('./routes/snipeit')(app, ctx);
require('./routes/chat')(app, ctx);
require('./routes/maintenance')(app, ctx);
require('./routes/inventory')(app, ctx);
require('./routes/ai')(app, ctx);
require('./routes/snipeitAi')(app, ctx);
require('./routes/cargo')(app, ctx);
require('./routes/bitlocker')(app, ctx);
require('./routes/user360')(app, ctx);
require('./routes/misc')(app, ctx);

// ── Serve static React frontend ─────────────────────────────
const CLIENT_DIR = path.join(__dirname, 'client');
app.use(express.static(CLIENT_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/files/') || req.path.startsWith('/updates/')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// ── Shutdown ────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[Server] ${signal} alındı, kapanıyor...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

// ── Listen & migrations ─────────────────────────────────────
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Server] Sunucu ayakta: http://0.0.0.0:${PORT}`);
  try {
    await pool.query('ALTER TABLE toner_changes MODIFY COLUMN id INT AUTO_INCREMENT');
    console.log('[MySQL Migration] toner_changes id column altered to AUTO_INCREMENT successfully.');
  } catch (err) {
    console.warn('[MySQL Migration] Could not alter toner_changes table:', err.message);
  }

  try {
    const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'manager_id'");
    if (userCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN manager_id INT NULL DEFAULT NULL");
      console.log('[MySQL Migration] users table manager_id column added successfully.');
    }
    const [locCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'allowed_locations'");
    if (locCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN allowed_locations VARCHAR(500) NULL DEFAULT NULL");
      console.log('[MySQL Migration] users table allowed_locations column added successfully.');
    }
  } catch (err) {
    console.warn('[MySQL Migration] Could not ensure user columns on users table:', err.message);
  }

  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        target_roles VARCHAR(255) DEFAULT 'all',
        target_users TEXT DEFAULT NULL,
        frequency VARCHAR(50) DEFAULT 'once',
        daily_time VARCHAR(10) DEFAULT NULL,
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        announcement_id INT NOT NULL,
        username VARCHAR(255) NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_announcement_user (announcement_id, username),
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS public_file_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        source_mode ENUM('db', 'storage') NOT NULL DEFAULT 'db',
        file_id INT NULL,
        storage_path VARCHAR(500) NULL,
        name VARCHAR(255) NOT NULL,
        type ENUM('file', 'folder', 'note') NOT NULL DEFAULT 'file',
        size BIGINT DEFAULT 0,
        created_by INT NOT NULL,
        password_hash VARCHAR(255) NULL,
        expires_at DATETIME NULL,
        download_limit INT NULL,
        download_count INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[MySQL Migration] announcements, announcement_reads, and public_file_shares tables ensured.');
  } catch (err) {
    console.error('[MySQL Migration] Tables error:', err.message);
  }

  await webpush.ensurePushTable();
});
