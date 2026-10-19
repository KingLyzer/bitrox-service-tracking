-- =========================================================
-- Migration 008 - Extended Snipe-IT location address fields
-- =========================================================

ALTER TABLE cached_locations ADD COLUMN address2 TEXT;
ALTER TABLE cached_locations ADD COLUMN city TEXT;
ALTER TABLE cached_locations ADD COLUMN state TEXT;
ALTER TABLE cached_locations ADD COLUMN country TEXT;
ALTER TABLE cached_locations ADD COLUMN zip TEXT;
ALTER TABLE cached_locations ADD COLUMN parent_id INTEGER;
ALTER TABLE cached_locations ADD COLUMN parent_name TEXT;
