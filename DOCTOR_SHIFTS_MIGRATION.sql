-- ============================================================================
-- DOCTOR SHIFTS MIGRATION
-- ============================================================================
-- Records the DOCTOR's own daily shift:
--   * shift start / end time
--   * start pulse / end pulse  (the doctor's pulse-counter readings)
--   * pulses in the day = end pulse - start pulse  (computed in the app)
--   * month totals: pulses, days worked, working hours (computed in the app)
--
-- These pulses are the doctor's own counter and are NOT related to the
-- "نبضة" service that is sold to clients in the cashier.
--
-- One row per doctor per day (UNIQUE) so re-saving a day updates it, and every
-- month starts from zero automatically because totals are grouped by month.
--
-- Safe to run more than once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS doctor_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_start TIME,
  shift_end TIME,
  start_pulse INTEGER NOT NULL DEFAULT 0,
  end_pulse INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- one shift per doctor per day
  CONSTRAINT doctor_shifts_unique_day UNIQUE (barber_id, work_date),
  -- the counter can never run backwards
  CONSTRAINT doctor_shifts_pulses_valid CHECK (end_pulse IS NULL OR end_pulse >= start_pulse),
  CONSTRAINT doctor_shifts_pulse_positive CHECK (start_pulse >= 0),
  -- a shift cannot end before it starts unless it crosses midnight
  CONSTRAINT doctor_shifts_time_valid CHECK (
    shift_start IS NULL OR shift_end IS NULL OR shift_end <> shift_start
  )
);

CREATE INDEX IF NOT EXISTS idx_doctor_shifts_clinic_id ON doctor_shifts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_shifts_barber_date ON doctor_shifts(barber_id, work_date DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_doctor_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_doctor_shifts_updated_at ON doctor_shifts;
CREATE TRIGGER trigger_doctor_shifts_updated_at
  BEFORE UPDATE ON doctor_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_shifts_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- NOTE: auth_user_id is compared as text on purpose - the live admin_auth
-- column can be character varying, and `varchar = uuid` has no operator.
-- ---------------------------------------------------------------------------
ALTER TABLE doctor_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view doctor shifts for their clinic" ON doctor_shifts;
CREATE POLICY "Staff can view doctor shifts for their clinic"
  ON doctor_shifts
  FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth
      WHERE auth_user_id::text = auth.uid()::text
        AND COALESCE(active, true) = true
    )
  );

DROP POLICY IF EXISTS "Staff can create doctor shifts for their clinic" ON doctor_shifts;
CREATE POLICY "Staff can create doctor shifts for their clinic"
  ON doctor_shifts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth
      WHERE auth_user_id::text = auth.uid()::text
        AND COALESCE(active, true) = true
    )
  );

DROP POLICY IF EXISTS "Staff can update doctor shifts for their clinic" ON doctor_shifts;
CREATE POLICY "Staff can update doctor shifts for their clinic"
  ON doctor_shifts
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth
      WHERE auth_user_id::text = auth.uid()::text
        AND COALESCE(active, true) = true
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth
      WHERE auth_user_id::text = auth.uid()::text
        AND COALESCE(active, true) = true
    )
  );

DROP POLICY IF EXISTS "Staff can delete doctor shifts for their clinic" ON doctor_shifts;
CREATE POLICY "Staff can delete doctor shifts for their clinic"
  ON doctor_shifts
  FOR DELETE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth
      WHERE auth_user_id::text = auth.uid()::text
        AND COALESCE(active, true) = true
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (so the app never hits a permission error)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_shifts TO authenticated;

-- ---------------------------------------------------------------------------
-- Report: what the app will read
-- ---------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'doctor_shifts'
ORDER BY ordinal_position;

SELECT '✅ doctor_shifts ready' AS status;
