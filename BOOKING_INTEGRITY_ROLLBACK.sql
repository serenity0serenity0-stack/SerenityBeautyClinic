-- ============================================================================
-- BOOKING INTEGRITY ROLLBACK
-- ============================================================================
-- Reverts BOOKING_INTEGRITY_MIGRATION.sql.
--   - Restores the original status of bookings that were auto-cancelled by the
--     migration (from booking_integrity_backup).
--   - Removes trigger, constraints, indexes, columns, and the waiting_list
--     table added by the migration.
-- NOTE: waiting_list rows created after the migration are dropped with the table.
-- ============================================================================

-- ---- 1) Restore auto-cancelled bookings (duplicates / overlaps) -----------
UPDATE bookings b
   SET status = bk.old_status, updated_at = NOW()
  FROM booking_integrity_backup bk
 WHERE bk.id = b.id;

-- ---- 2) Drop trigger + function -------------------------------------------
DROP TRIGGER IF EXISTS trg_bookings_before_write ON bookings;
DROP FUNCTION IF EXISTS bookings_before_write();

-- ---- 3) Drop the UNIQUE backstop index ------------------------------------
DROP INDEX IF EXISTS bookings_no_double_booking_unique;

-- ---- 4) Drop indexes added by the migration --------------------------------
DROP INDEX IF EXISTS idx_bookings_clinic_barber_time;
DROP INDEX IF EXISTS idx_bookings_clinic_phone;
DROP INDEX IF EXISTS idx_bookings_status;

-- ---- 5) Drop constraints ---------------------------------------------------
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_duration_check;

-- ---- 6) Drop columns added by the migration --------------------------------
ALTER TABLE bookings DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE bookings DROP COLUMN IF EXISTS service_name;

ALTER TABLE barbers DROP COLUMN IF EXISTS working_hours_start;
ALTER TABLE barbers DROP COLUMN IF EXISTS working_hours_end;
ALTER TABLE barbers DROP COLUMN IF EXISTS days_off;
ALTER TABLE barbers DROP COLUMN IF EXISTS vacation_start;
ALTER TABLE barbers DROP COLUMN IF EXISTS vacation_end;

-- ---- 7) Drop the waiting list table ----------------------------------------
DROP TABLE IF EXISTS waiting_list;

-- ---- 8) Backup table is kept for audit purposes (not dropped) --------------
-- SELECT 'rollback complete' AS status;
