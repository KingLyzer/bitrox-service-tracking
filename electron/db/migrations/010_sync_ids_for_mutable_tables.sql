ALTER TABLE service_tickets ADD COLUMN sync_id TEXT;
ALTER TABLE stock_items ADD COLUMN sync_id TEXT;
ALTER TABLE toner_items ADD COLUMN sync_id TEXT;
ALTER TABLE stock_movements ADD COLUMN sync_id TEXT;
ALTER TABLE toner_changes ADD COLUMN sync_id TEXT;
ALTER TABLE attachments ADD COLUMN sync_id TEXT;

UPDATE service_tickets
SET sync_id = 'service-ticket-' || id
WHERE sync_id IS NULL OR sync_id = '';

UPDATE stock_items
SET sync_id = 'stock-item-' || id
WHERE sync_id IS NULL OR sync_id = '';

UPDATE toner_items
SET sync_id = 'toner-item-' || id
WHERE sync_id IS NULL OR sync_id = '';

UPDATE stock_movements
SET sync_id = 'stock-movement-' || id
WHERE sync_id IS NULL OR sync_id = '';

UPDATE toner_changes
SET sync_id = 'toner-change-' || id
WHERE sync_id IS NULL OR sync_id = '';

UPDATE attachments
SET sync_id = 'attachment-' || id
WHERE sync_id IS NULL OR sync_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_tickets_sync_id
ON service_tickets(sync_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_sync_id
ON stock_items(sync_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_toner_items_sync_id
ON toner_items(sync_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_sync_id
ON stock_movements(sync_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_toner_changes_sync_id
ON toner_changes(sync_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_sync_id
ON attachments(sync_id);
