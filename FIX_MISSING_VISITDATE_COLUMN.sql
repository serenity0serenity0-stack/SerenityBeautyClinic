-- ✅ FIX: Add all missing columns to visit_logs table
-- Ensures complete schema alignment with application requirements

BEGIN;

-- Add missing UUID reference columns
DO $$ 
BEGIN
  -- clinic_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='clinic_id'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN clinic_id UUID REFERENCES clinic(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added clinic_id column to visit_logs';
  END IF;

  -- client_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='client_id'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added client_id column to visit_logs';
  END IF;

  -- booking_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='booking_id'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added booking_id column to visit_logs';
  END IF;

  -- barber_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='barber_id'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added barber_id column to visit_logs';
  END IF;

END $$;

-- Add missing data columns
DO $$ 
BEGIN
  -- service_type (varchar)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='service_type'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN service_type VARCHAR(255);
    RAISE NOTICE '✅ Added service_type column to visit_logs';
  END IF;

  -- duration (integer)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='duration'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN duration INTEGER;
    RAISE NOTICE '✅ Added duration column to visit_logs';
  END IF;

  -- amount (numeric)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='amount'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN amount NUMERIC(10, 2);
    RAISE NOTICE '✅ Added amount column to visit_logs';
  END IF;

END $$;

-- Add missing date/time columns
DO $$ 
BEGIN
  -- visit_date (lowercase snake_case version if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='visit_date'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN visit_date DATE;
    RAISE NOTICE '✅ Added visit_date column to visit_logs';
  END IF;

  -- visitDate (camelCase version - already referenced in code)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='visitDate'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN "visitDate" DATE;
    RAISE NOTICE '✅ Added visitDate column to visit_logs';
  END IF;

END $$;

-- Verify all columns now exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='visit_logs' 
ORDER BY ordinal_position;

COMMIT;
