-- =========================================================
-- Servis ve Toner Takip Sistemi — Veritabanı Şeması
-- Migration 002 — Snipe-IT Refactor
-- =========================================================

PRAGMA foreign_keys = OFF;

-- Eski Modülleri Sil (Gereksiz tablolar)
DROP TABLE IF EXISTS used_parts;
DROP TABLE IF EXISTS service_operations;
DROP TABLE IF EXISTS toner_changes;
DROP TABLE IF EXISTS service_tickets;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS printers;
DROP TABLE IF EXISTS printer_models;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS device_types;
DROP TABLE IF EXISTS brands;

-- -------------------------------------------------------
-- CACHED SNIPE-IT VERİLERİ
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cached_locations (
  id INTEGER PRIMARY KEY,
  name TEXT,
  address TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  name TEXT,
  email TEXT,
  department_id INTEGER,
  department_name TEXT,
  location_id INTEGER,
  location_name TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_manufacturers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_models (
  id INTEGER PRIMARY KEY,
  name TEXT,
  manufacturer_id INTEGER,
  manufacturer_name TEXT,
  category_id INTEGER,
  category_name TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_assets (
  id INTEGER PRIMARY KEY,
  name TEXT,
  asset_tag TEXT,
  serial TEXT,
  model_id INTEGER,
  model_name TEXT,
  category_name TEXT,
  status_id INTEGER,
  status_name TEXT,
  assigned_to_user_id INTEGER,
  assigned_to_user_name TEXT,
  location_id INTEGER,
  location_name TEXT,
  manufacturer_id INTEGER,
  manufacturer_name TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- YENİDEN OLUŞTURULAN TABLOLAR (Snipe-IT Destekli)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Snipe-IT Bağlantıları
  asset_id INTEGER,
  asset_name TEXT,
  asset_tag TEXT,
  serial_no TEXT,
  model_name TEXT,
  category_name TEXT,
  
  user_id INTEGER,
  user_name TEXT,
  location_name TEXT,
  
  fault_desc TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Normal', -- Düşük / Normal / Yüksek / Acil
  status TEXT NOT NULL DEFAULT 'Yeni Kayıt',
  notes TEXT,
  delivery_date DATE,
  closed_at DATETIME
);

CREATE TABLE IF NOT EXISTS service_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  op_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER,
  op_type TEXT NOT NULL DEFAULT 'Genel',
  description TEXT NOT NULL,
  duration_min INTEGER DEFAULT 0,
  status_change TEXT,
  internal_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS used_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  stock_id INTEGER,
  part_name TEXT NOT NULL,
  stock_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Adet',
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES service_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES stock_items(id)
);

CREATE TABLE IF NOT EXISTS toner_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL, -- Snipe-IT yazıcı ID'si
  asset_name TEXT,
  toner_id INTEGER NOT NULL,
  change_date DATE NOT NULL DEFAULT (date('now')),
  user_id INTEGER,
  assigned_user_name TEXT,
  page_count INTEGER,
  old_page_count INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (toner_id) REFERENCES toner_items(id)
);

PRAGMA foreign_keys = ON;
