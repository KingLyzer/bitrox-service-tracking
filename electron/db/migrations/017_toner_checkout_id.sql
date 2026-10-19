-- =========================================================
-- Migration 017 - Add snipeit_checkout_id to toner_changes
-- =========================================================

ALTER TABLE toner_changes ADD COLUMN snipeit_checkout_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_toner_changes_snipeit_checkout
  ON toner_changes (snipeit_checkout_id);
