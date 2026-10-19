'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Otomatik .env yükleyici (server/.env veya kök dizindeki .env)
const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env')
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      });
    } catch (e) {
      console.warn('[DB] .env okuma uyarısı:', e.message);
    }
    break;
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'servicetracker_db',
  waitForConnections: true,
  connectionLimit: 35,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
});

module.exports = { pool };
