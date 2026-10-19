-- =========================================================
-- Migration 007 - Snipe-IT components and consumable quantity history
-- =========================================================

ALTER TABLE stock_items ADD COLUMN snipeit_component_id INTEGER;
ALTER TABLE stock_items ADD COLUMN snipeit_category_id INTEGER;
ALTER TABLE stock_items ADD COLUMN category_name TEXT;
ALTER TABLE stock_items ADD COLUMN company_id INTEGER;
ALTER TABLE stock_items ADD COLUMN company_name TEXT;
ALTER TABLE stock_items ADD COLUMN supplier_name TEXT;
ALTER TABLE stock_items ADD COLUMN manufacturer_id INTEGER;
ALTER TABLE stock_items ADD COLUMN manufacturer_name TEXT;
ALTER TABLE stock_items ADD COLUMN location_id INTEGER;
ALTER TABLE stock_items ADD COLUMN location_name TEXT;
ALTER TABLE stock_items ADD COLUMN model_number TEXT;
ALTER TABLE stock_items ADD COLUMN serial_no TEXT;
ALTER TABLE stock_items ADD COLUMN order_number TEXT;
ALTER TABLE stock_items ADD COLUMN purchase_date DATE;
ALTER TABLE stock_items ADD COLUMN purchase_cost REAL DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN total_qty REAL DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN available_qty REAL DEFAULT 0;

ALTER TABLE toner_changes ADD COLUMN qty INTEGER DEFAULT 1;
