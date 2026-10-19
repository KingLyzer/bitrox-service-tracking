ALTER TABLE service_operations ADD COLUMN sync_id TEXT;
ALTER TABLE used_parts ADD COLUMN sync_id TEXT;

UPDATE service_operations
SET sync_id = 'service-operation-' || id
WHERE sync_id IS NULL OR sync_id = '';

UPDATE used_parts
SET sync_id = 'used-part-' || id
WHERE sync_id IS NULL OR sync_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_operations_sync_id
ON service_operations(sync_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_used_parts_sync_id
ON used_parts(sync_id);
