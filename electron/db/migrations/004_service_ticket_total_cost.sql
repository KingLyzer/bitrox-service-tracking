-- =========================================================
-- Migration 004 - Service ticket cost summary
-- =========================================================

ALTER TABLE service_tickets ADD COLUMN total_cost REAL DEFAULT 0;
