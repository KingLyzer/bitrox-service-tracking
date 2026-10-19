CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_role_module
  ON permissions(role_id, module);

CREATE INDEX IF NOT EXISTS idx_deleted_sync_ids_lookup
  ON deleted_sync_ids(table_name, sync_id);
