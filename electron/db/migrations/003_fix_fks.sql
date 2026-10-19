-- =========================================================
-- Migration 003 — Fix Foreign Keys for Dropped Tables
-- =========================================================

PRAGMA foreign_keys = OFF;

-- Fix stock_items
CREATE TABLE IF NOT EXISTS stock_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER,
  brand_compat TEXT,
  model_compat TEXT,
  qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Adet',
  critical_qty REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  supplier_id INTEGER,
  location TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO stock_items_new SELECT * FROM stock_items;
DROP TABLE stock_items;
ALTER TABLE stock_items_new RENAME TO stock_items;

-- Fix toner_items
CREATE TABLE IF NOT EXISTS toner_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toner_code TEXT NOT NULL UNIQUE,
  toner_model TEXT NOT NULL,
  brand_id INTEGER,
  color TEXT DEFAULT 'Siyah', 
  compatible_printers TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  critical_qty INTEGER DEFAULT 2,
  unit_price REAL DEFAULT 0,
  supplier_id INTEGER,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO toner_items_new SELECT * FROM toner_items;
DROP TABLE toner_items;
ALTER TABLE toner_items_new RENAME TO toner_items;

PRAGMA foreign_keys = ON;
