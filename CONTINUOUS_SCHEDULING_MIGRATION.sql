-- ============================================================================
-- DURATION & CONTINUOUS SCHEDULING MIGRATION (additive, non-destructive)
-- ----------------------------------------------------------------------------
-- Replaces bookings_before_write() with a concurrency-safe version that:
--   * keeps all existing validations (past time, working hours, vacation,
--     days off, duration-aware per-doctor overlap),
--   * serializes per-doctor booking writes with a transaction-scoped advisory
--     lock so two transactions cannot both pass the overlap check,
--   * still allows cancelled appointments to be overwritten (release rule).
--
-- SAFETY:
--   - No table/column changes, no data deletion, no RLS changes.
--   - Idempotent: safe to run multiple times.
--   - Does NOT touch historical appointment durations.
--   - Does NOT reschedule any existing appointment.
--
-- HOW TO RUN:
--   Paste this whole file into the Supabase SQL editor and run it.
--   (No password/pooler access is available from this environment.)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."bookings_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
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

  -- ---- concurrency guard ---------------------------------------------
  -- Serialize writes for the same doctor so the overlap check below cannot
  -- race between two concurrent transactions. The lock is transaction-scoped
  -- and is released automatically at COMMIT/ROLLBACK.
  IF NEW.barber_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.barber_id::text)::bigint);
  END IF;

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
        SELECT b.id, b.booking_time, b.duration, b.status
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
$_$;

-- Re-attach the trigger (function body changed; trigger definition unchanged).
CREATE OR REPLACE TRIGGER "trg_bookings_before_write"
  BEFORE INSERT OR UPDATE ON "public"."bookings"
  FOR EACH ROW EXECUTE FUNCTION "public"."bookings_before_write"();