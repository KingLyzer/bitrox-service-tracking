-- =========================================================
-- Migration 005 - User based toner changes
-- =========================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS toner_changes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER,
  asset_name TEXT,
  toner_id INTEGER NOT NULL,
  change_date DATE NOT NULL DEFAULT (date('now')),
  user_id INTEGER,
  assigned_user_id INTEGER,
  assigned_user_name TEXT,
  page_count INTEGER,
  old_page_count INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (toner_id) REFERENCES toner_items(id)
);

INSERT INTO toner_changes_new (
  id, asset_id, asset_name, toner_id, change_date, user_id,
  assigned_user_name, page_count, old_page_count, notes, created_at
)
SELECT
  id, asset_id, asset_name, toner_id, change_date, user_id,
  assigned_user_name, page_count, old_page_count, notes, created_at
FROM toner_changes;

DROP TABLE toner_changes;
ALTER TABLE toner_changes_new RENAME TO toner_changes;

PRAGMA foreign_keys = ON;
