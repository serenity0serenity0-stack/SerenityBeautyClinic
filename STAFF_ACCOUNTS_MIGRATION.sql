-- ============================================================================
-- STAFF ACCOUNT TRACKING MIGRATION (additive, non-destructive)
-- ----------------------------------------------------------------------------
-- Adds a created_by column to transactions so each sale can be attributed to
-- the staff account (cashier/admin) who recorded it. Required for the
-- per-account usage report.
--
-- SAFETY:
--   - No data deletion. Existing rows get NULL created_by (historical).
--   - Idempotent.
-- ============================================================================

ALTER TABLE "public"."transactions"
  ADD COLUMN IF NOT EXISTS "created_by" "uuid";

CREATE INDEX IF NOT EXISTS "idx_transactions_created_by"
  ON "public"."transactions" ("created_by");

CREATE INDEX IF NOT EXISTS "idx_transactions_clinic_date"
  ON "public"."transactions" ("clinic_id", "date");