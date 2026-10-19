-- =========================================================
-- Migration 006 - Snipe-IT consumables integration
-- =========================================================

CREATE TABLE IF NOT EXISTS cached_companies (
  id INTEGER PRIMARY KEY,
  name TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_categories (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category_type TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE toner_items ADD COLUMN snipeit_consumable_id INTEGER;
ALTER TABLE toner_items ADD COLUMN company_id INTEGER;
ALTER TABLE toner_items ADD COLUMN company_name TEXT;
ALTER TABLE toner_items ADD COLUMN category_id INTEGER;
ALTER TABLE toner_items ADD COLUMN category_name TEXT;
ALTER TABLE toner_items ADD COLUMN supplier_name TEXT;
ALTER TABLE toner_items ADD COLUMN manufacturer_id INTEGER;
ALTER TABLE toner_items ADD COLUMN manufacturer_name TEXT;
ALTER TABLE toner_items ADD COLUMN location_id INTEGER;
ALTER TABLE toner_items ADD COLUMN location_name TEXT;
ALTER TABLE toner_items ADD COLUMN model_number TEXT;
ALTER TABLE toner_items ADD COLUMN item_no TEXT;
ALTER TABLE toner_items ADD COLUMN order_number TEXT;
ALTER TABLE toner_items ADD COLUMN purchase_date DATE;
ALTER TABLE toner_items ADD COLUMN purchase_cost REAL DEFAULT 0;
ALTER TABLE toner_items ADD COLUMN total_qty INTEGER DEFAULT 0;
ALTER TABLE toner_items ADD COLUMN available_qty INTEGER DEFAULT 0;
