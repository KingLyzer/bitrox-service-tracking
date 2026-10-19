DROP TABLE IF EXISTS message_reads;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS message_group_members;
DROP TABLE IF EXISTS message_groups;

ALTER TABLE service_operations ADD COLUMN ticket_sync_id TEXT;
ALTER TABLE used_parts ADD COLUMN ticket_sync_id TEXT;

UPDATE service_operations
SET ticket_sync_id = (
  SELECT service_tickets.sync_id
  FROM service_tickets
  WHERE service_tickets.id = service_operations.ticket_id
)
WHERE ticket_sync_id IS NULL OR ticket_sync_id = '';

UPDATE used_parts
SET ticket_sync_id = (
  SELECT service_tickets.sync_id
  FROM service_tickets
  WHERE service_tickets.id = used_parts.ticket_id
)
WHERE ticket_sync_id IS NULL OR ticket_sync_id = '';

CREATE INDEX IF NOT EXISTS idx_service_operations_ticket_sync_id
  ON service_operations(ticket_sync_id);

CREATE INDEX IF NOT EXISTS idx_used_parts_ticket_sync_id
  ON used_parts(ticket_sync_id);
