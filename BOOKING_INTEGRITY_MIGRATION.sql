-- ============================================================================
-- BOOKING INTEGRITY MIGRATION
-- ============================================================================
-- Purpose (see BOOKING_SYSTEM_REQUIREMENTS.md):
--   1. Prevent double-booking: a doctor must never have two appointments at
--      the same date/time (DB-level UNIQUE index + overlap trigger).
--   2. Reject bookings in the past (backend validation, clinic local time).
--   3. Validate status values and duration.
--   4. Add doctor schedule support: working hours, days off, vacations.
--   5. Create the waiting_list table (used only when no slot is available).
--   6. Add booking indexes + backfill derived columns for consistency.
--   7. Reconcile legacy portal columns (customer_phone / service_name)
--      with the canonical schema.
--
-- SAFETY:
--   - Idempotent (safe to run multiple times).
--   - Never deletes data. Overlapping / duplicate bookings are marked
--     'cancelled' and their original status is backed up so the migration can
--     be rolled back (see BOOKING_INTEGRITY_ROLLBACK.sql).
-- ============================================================================

-- ============================================================================
-- 1) STATUS VALUES CHECK CONSTRAINT
-- ============================================================================
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'ongoing', 'completed', 'cancelled'));

-- ============================================================================
-- 2) DURATION CHECK CONSTRAINT
-- ============================================================================
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_duration_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_duration_check
  CHECK (duration IS NULL OR duration >= 5);

-- ============================================================================
-- 3) DOCTOR SCHEDULE / VACATION COLUMNS
--    days_off uses Postgres EXTRACT(DOW): 0 = Sunday ... 6 = Saturday
-- ============================================================================
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS working_hours_start TIME DEFAULT '09:00';
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS working_hours_end   TIME DEFAULT '21:00';
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS days_off            JSONB DEFAULT '[]'::jsonb;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS vacation_start      DATE;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS vacation_end        DATE;

-- ============================================================================
-- 4) WAITING LIST TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS waiting_list (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID REFERENCES clinic(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name   VARCHAR(255) NOT NULL,
  client_phone  VARCHAR(20) NOT NULL,
  barber_id     UUID REFERENCES barbers(id) ON DELETE SET NULL,
  barber_name   VARCHAR(255),
  service_type  VARCHAR(255),
  duration      INT DEFAULT 30,
  status        VARCHAR(50) DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'notified', 'booked', 'removed')),
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waiting_list_clinic_id ON waiting_list(clinic_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_barber_id  ON waiting_list(barber_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_status     ON waiting_list(status);

-- ============================================================================
-- 5) LEGACY PORTAL COMPATIBILITY COLUMNS
--    The customer portal snapshots customer_phone / service_name on bookings.
--    These are kept in sync by the trigger below and backfilled here.
-- ============================================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name   VARCHAR(255);

UPDATE bookings SET customer_phone = client_phone  WHERE customer_phone IS NULL;
UPDATE bookings SET service_name   = service_type  WHERE service_name IS NULL;

-- ============================================================================
-- 6) BOOKING INDEXES (performance)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_clinic_barber_time ON bookings(clinic_id, barber_id, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_clinic_phone       ON bookings(clinic_id, client_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_status             ON bookings(status);

-- ============================================================================
-- 7) BACKFILL booking_date
--    Convention: booking_time is a NAIVE timestamp in clinic (Cairo) wall time,
--    so booking_date is simply booking_time::date.
-- ============================================================================
UPDATE bookings
   SET booking_date = booking_time::date
 WHERE booking_date IS NULL;

-- ============================================================================
-- 8) BOOKING VALIDATION + DERIVED COLUMN TRIGGER
--   - keeps customer_phone / service_name / booking_date in sync
--    - rejects bookings in the past (clinic local time, 5 min grace)
--    - rejects bookings outside the doctor working hours / days off / vacation
--    - rejects overlapping bookings for the same doctor
-- ============================================================================
CREATE OR REPLACE FUNCTION bookings_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking_cairo  timestamp;
  v_wh_start       time;
  v_wh_end         time;
  v_vac_start      date;
  v_vac_end        date;
  v_days_off       jsonb;
  v_start          timestamptz;
  v_end            timestamptz;
  v_other          record;
  v_other_start    timestamptz;
  v_other_end      timestamptz;
BEGIN
  -- ---- derived columns ------------------------------------------------
  NEW.customer_phone  := COALESCE(NEW.customer_phone, NEW.client_phone);
  NEW.service_name    := COALESCE(NEW.service_name, NEW.service_type);
  NEW.booking_date    := NEW.booking_time::date;
  NEW.updated_at      := NOW();

  -- Only validate when schedule-relevant fields actually change.
  IF TG_OP = 'INSERT'
     OR NEW.booking_time IS DISTINCT FROM OLD.booking_time
     OR NEW.barber_id     IS DISTINCT FROM OLD.barber_id
     OR NEW.duration      IS DISTINCT FROM OLD.duration THEN

    -- booking_time is a naive timestamp in clinic (Cairo) wall time.
    v_booking_cairo := NEW.booking_time;

    -- ---- past-time guard (clinic local time) ---------------------------
    IF v_booking_cairo < (NOW() AT TIME ZONE 'Africa/Cairo') - interval '5 minutes' THEN
      RAISE EXCEPTION 'Cannot book an appointment in the past (booking_time is in the past)'
        USING ERRCODE = 'P0001';
    END IF;

    -- ---- doctor availability guard -------------------------------------
    IF NEW.barber_id IS NOT NULL THEN
      SELECT working_hours_start, working_hours_end, vacation_start, vacation_end, days_off
        INTO v_wh_start, v_wh_end, v_vac_start, v_vac_end, v_days_off
        FROM barbers
       WHERE id = NEW.barber_id;

      IF v_wh_start IS NOT NULL AND v_wh_end IS NOT NULL AND v_wh_end > v_wh_start THEN
        IF v_booking_cairo::time < v_wh_start
           OR v_booking_cairo::time + (COALESCE(NEW.duration, 30) * interval '1 minute') > v_wh_end THEN
          RAISE EXCEPTION 'This booking is outside the doctor working hours'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;

      IF v_vac_start IS NOT NULL AND v_booking_cairo::date BETWEEN v_vac_start AND v_vac_end THEN
        RAISE EXCEPTION 'This doctor is on vacation'
          USING ERRCODE = 'P0001';
      END IF;

      IF jsonb_typeof(COALESCE(v_days_off, '[]'::jsonb)) = 'array'
         AND EXISTS (
           SELECT 1
             FROM jsonb_array_elements_text(COALESCE(v_days_off, '[]'::jsonb)) AS dow
            WHERE dow ~ '^[0-6]$' AND dow::int = EXTRACT(DOW FROM v_booking_cairo::date)
         ) THEN
        RAISE EXCEPTION 'This doctor is off duty on the selected day'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- ---- per-doctor overlap guard (double-booking prevention) ----------
    IF NEW.barber_id IS NOT NULL THEN
      v_start := NEW.booking_time;
      v_end   := NEW.booking_time + COALESCE(NEW.duration, 30) * interval '1 minute';

      FOR v_other IN
        SELECT b.booking_time, b.duration
          FROM bookings b
         WHERE b.barber_id = NEW.barber_id
           AND b.id <> NEW.id
           AND b.status <> 'cancelled'
      LOOP
        v_other_start := v_other.booking_time;
        v_other_end   := v_other.booking_time + COALESCE(v_other.duration, 30) * interval '1 minute';

        IF v_start < v_other_end AND v_end > v_other_start THEN
          RAISE EXCEPTION 'This time slot is already booked for this doctor'
            USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_before_write ON bookings;
CREATE TRIGGER trg_bookings_before_write
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION bookings_before_write();

-- ============================================================================
-- 9) CLEAN UP EXISTING DOUBLE-BOOKINGS
--    Backs up original status, then marks duplicates / overlaps as 'cancelled'
--    so the UNIQUE index below can be created without failing on legacy data.
-- ============================================================================
CREATE TABLE IF NOT EXISTS booking_integrity_backup (
  id            UUID PRIMARY KEY,
  old_status    VARCHAR(50),
  reason        VARCHAR(255),
  changed_at    TIMESTAMP DEFAULT NOW()
);

-- 9a) Exact duplicates (same doctor, same booking_time) -> keep earliest
INSERT INTO booking_integrity_backup (id, old_status, reason)
SELECT b.id, b.status, 'exact_duplicate'
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY barber_id, booking_time
             ORDER BY CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END,
                      created_at ASC, id ASC
           ) AS rn
      FROM bookings
     WHERE barber_id IS NOT NULL
  ) r
  JOIN bookings b ON b.id = r.id
 WHERE r.rn > 1
   AND NOT EXISTS (SELECT 1 FROM booking_integrity_backup bk WHERE bk.id = b.id);

UPDATE bookings b
   SET status = 'cancelled', updated_at = NOW()
  FROM booking_integrity_backup bk
 WHERE bk.id = b.id AND bk.reason = 'exact_duplicate';

-- 9b) Overlapping active bookings (same doctor, overlapping intervals) -> keep earliest
DO $$
DECLARE
  cur        CURSOR FOR
    SELECT b.id, b.barber_id, b.booking_time, COALESCE(b.duration, 30) AS duration
      FROM bookings b
     WHERE b.barber_id IS NOT NULL AND b.status <> 'cancelled'
     ORDER BY b.barber_id, b.booking_time ASC, b.created_at ASC, b.id ASC;
  rec        record;
  last_end   timestamptz;
  last_barber uuid;
BEGIN
  last_end := NULL;
  last_barber := NULL;

  FOR rec IN cur LOOP
    IF last_barber IS DISTINCT FROM rec.barber_id THEN
      last_barber := rec.barber_id;
      last_end    := rec.booking_time + rec.duration * interval '1 minute';
    ELSIF rec.booking_time < last_end THEN
      INSERT INTO booking_integrity_backup (id, old_status, reason)
      VALUES (rec.id, 'active', 'overlap')
      ON CONFLICT (id) DO NOTHING;

      UPDATE bookings
         SET status = 'cancelled', updated_at = NOW()
       WHERE id = rec.id;
    ELSE
      last_end := rec.booking_time + rec.duration * interval '1 minute';
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 10) UNIQUE INDEX — hard backstop against double-booking (race conditions)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_double_booking_unique
  ON bookings (barber_id, booking_time)
  WHERE barber_id IS NOT NULL AND status <> 'cancelled';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'bookings_status_check'          AS item, EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check'
) AS present
UNION ALL
SELECT 'barbers.working_hours_start',   EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'barbers' AND column_name = 'working_hours_start'
)
UNION ALL
SELECT 'waiting_list table',            EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_name = 'waiting_list'
)
UNION ALL
SELECT 'bookings_no_double_booking_unique', EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'bookings_no_double_booking_unique'
)
UNION ALL
SELECT 'trg_bookings_before_write',     EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_before_write'
);
