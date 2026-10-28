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
const distDir = path.join(__dirname, '..', 'dist');
const CLIENT_DIR = fsSync.existsSync(path.join(distDir, 'index.html'))
  ? distDir
  : path.join(__dirname, 'client');
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
    // 1. service_tickets columns
    const ticketCols = [
      { name: 'asset_id', def: 'INT NULL' },
      { name: 'asset_tag', def: 'VARCHAR(100) NULL' },
      { name: 'serial_no', def: 'VARCHAR(100) NULL' },
      { name: 'model_name', def: 'VARCHAR(150) NULL' },
      { name: 'asset_name', def: 'VARCHAR(150) NULL' },
      { name: 'location_name', def: 'VARCHAR(150) NULL' },
      { name: 'fault_desc', def: 'TEXT NULL' },
      { name: 'notes', def: 'TEXT NULL' },
      { name: 'delivery_date', def: 'DATETIME NULL' },
      { name: 'user_name', def: 'VARCHAR(150) NULL' },
      { name: 'teknisyen', def: 'VARCHAR(150) NULL' },
      { name: 'record_type', def: "VARCHAR(50) DEFAULT 'service'" },
      { name: 'mac_address', def: 'VARCHAR(100) NULL' },
      { name: 'os_name', def: 'VARCHAR(100) NULL' },
      { name: 'os_license', def: 'VARCHAR(100) NULL' },
      { name: 'closed_at', def: 'DATETIME NULL' }
    ];
    for (const c of ticketCols) {
      const [exists] = await pool.query(`SHOW COLUMNS FROM service_tickets LIKE '${c.name}'`);
      if (exists.length === 0) {
        await pool.query(`ALTER TABLE service_tickets ADD COLUMN ${c.name} ${c.def}`).catch(() => {});
      }
    }

    // 2. toner_items columns
    const tonerCols = [
      { name: 'qty', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'available_qty', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'critical_qty', def: 'INT NOT NULL DEFAULT 2' },
      { name: 'model_number', def: 'VARCHAR(100) NULL' },
      { name: 'item_no', def: 'VARCHAR(100) NULL' },
      { name: 'order_number', def: 'VARCHAR(100) NULL' },
      { name: 'purchase_date', def: 'DATE NULL' },
      { name: 'unit_price', def: 'DECIMAL(10,2) DEFAULT 0.00' },
      { name: 'is_active', def: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'snipeit_consumable_id', def: 'INT NULL' },
      { name: 'category_id', def: 'INT NULL' },
      { name: 'category_name', def: 'VARCHAR(150) NULL' },
      { name: 'company_id', def: 'INT NULL' },
      { name: 'company_name', def: 'VARCHAR(150) NULL' },
      { name: 'min_amt', def: 'INT DEFAULT 0' }
    ];
    for (const c of tonerCols) {
      const [exists] = await pool.query(`SHOW COLUMNS FROM toner_items LIKE '${c.name}'`);
      if (exists.length === 0) {
        await pool.query(`ALTER TABLE toner_items ADD COLUMN ${c.name} ${c.def}`).catch(() => {});
      }
    }

    // 2.1. toner_changes columns
    const tonerChangesCols = [
      { name: 'user_id', def: 'INT NULL' },
      { name: 'old_page_count', def: 'INT NULL' },
      { name: 'snipeit_checkout_id', def: 'VARCHAR(100) NULL' }
    ];
    for (const c of tonerChangesCols) {
      const [exists] = await pool.query(`SHOW COLUMNS FROM toner_changes LIKE '${c.name}'`);
      if (exists.length === 0) {
        await pool.query(`ALTER TABLE toner_changes ADD COLUMN ${c.name} ${c.def}`).catch(() => {});
      }
    }

    // 2.2. announcements columns
    const announcementCols = [
      { name: 'start_date', def: 'DATE DEFAULT NULL' },
      { name: 'end_date', def: 'DATE DEFAULT NULL' },
      { name: 'daily_time', def: 'VARCHAR(10) DEFAULT NULL' },
      { name: 'frequency', def: "VARCHAR(50) DEFAULT 'once'" },
      { name: 'target_users', def: 'TEXT DEFAULT NULL' }
    ];
    for (const c of announcementCols) {
      const [exists] = await pool.query(`SHOW COLUMNS FROM announcements LIKE '${c.name}'`);
      if (exists.length === 0) {
        await pool.query(`ALTER TABLE announcements ADD COLUMN ${c.name} ${c.def}`).catch(() => {});
      }
    }

    // 3. stock tables
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stock_code VARCHAR(100) NOT NULL,
        name VARCHAR(200) NOT NULL,
        barcode VARCHAR(128) DEFAULT NULL,
        category_id INT NULL,
        category_name VARCHAR(150) NULL,
        brand_compat VARCHAR(255) NULL,
        model_compat VARCHAR(255) NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'Adet',
        qty DECIMAL(10,2) NOT NULL DEFAULT 0,
        available_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
        critical_qty DECIMAL(10,2) DEFAULT 0,
        unit_price DECIMAL(12,2) DEFAULT 0,
        supplier_id INT NULL,
        location VARCHAR(150) NULL,
        description TEXT NULL,
        stock_type VARCHAR(32) NOT NULL DEFAULT 'office',
        snipeit_component_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_stock_code (stock_code),
        INDEX idx_stock_barcode (barcode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stock_id INT NOT NULL,
        move_type VARCHAR(50) NOT NULL,
        qty DECIMAL(10,2) NOT NULL,
        ref_type VARCHAR(50) NULL,
        ref_id INT NULL,
        user_id INT NULL,
        receiver VARCHAR(255) NULL,
        move_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stock_movement_stock (stock_id),
        INDEX idx_stock_movement_date (move_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure AUTO_INCREMENT on id columns so inserts with qty > 0 never fail
    try {
      await pool.execute('ALTER TABLE stock_movements MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT');
      await pool.execute('ALTER TABLE stock_movements MODIFY COLUMN move_date DATETIME DEFAULT CURRENT_TIMESTAMP');
    } catch (_) {}
    try {
      await pool.execute('ALTER TABLE used_parts MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT');
    } catch (_) {}
    try {
      await pool.execute('ALTER TABLE attachments MODIFY COLUMN id INT(11) NOT NULL AUTO_INCREMENT');
    } catch (_) {}

    // 4. cached tables
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_users (
        id INT PRIMARY KEY,
        username VARCHAR(100) NULL,
        name VARCHAR(150) NULL,
        email VARCHAR(150) NULL,
        department_id INT NULL,
        department_name VARCHAR(150) NULL,
        location_id INT NULL,
        location_name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_locations (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        address TEXT NULL,
        address2 TEXT NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        country VARCHAR(100) NULL,
        zip VARCHAR(50) NULL,
        parent_id INT NULL,
        parent_name VARCHAR(150) NULL,
        manager_id INT NULL,
        manager_name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_companies (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_suppliers (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_categories (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        category_type VARCHAR(100) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_manufacturers (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_models (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        manufacturer_id INT NULL,
        manufacturer_name VARCHAR(150) NULL,
        category_id INT NULL,
        category_name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cached_assets (
        id INT PRIMARY KEY,
        name VARCHAR(150) NULL,
        asset_tag VARCHAR(100) NULL,
        serial VARCHAR(100) NULL,
        model_id INT NULL,
        model_name VARCHAR(150) NULL,
        category_name VARCHAR(150) NULL,
        status_id INT NULL,
        status_name VARCHAR(100) NULL,
        assigned_to_user_id INT NULL,
        assigned_to_user_name VARCHAR(150) NULL,
        location_id INT NULL,
        location_name VARCHAR(150) NULL,
        manufacturer_id INT NULL,
        manufacturer_name VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asset_tag (asset_tag),
        INDEX idx_asset_serial (serial)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. installation tables
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS installation_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS installation_template_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 0,
        input_type VARCHAR(50) DEFAULT 'checkbox',
        is_required TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES installation_templates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS installation_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        input_type VARCHAR(50) DEFAULT 'checkbox',
        is_required TINYINT(1) DEFAULT 0,
        is_completed TINYINT(1) DEFAULT 0,
        completed_by VARCHAR(150) NULL,
        completed_at DATETIME NULL,
        task_value TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. sequences table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sequences (
        name VARCHAR(50) PRIMARY KEY,
        val INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[MySQL Migration] Core tables & columns ensured successfully.');
  } catch (err) {
    console.error('[MySQL Migration] Error ensuring core tables/columns:', err.message);
  }

  await webpush.ensurePushTable();
});
