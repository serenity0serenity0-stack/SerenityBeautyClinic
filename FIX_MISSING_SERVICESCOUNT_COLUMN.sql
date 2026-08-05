-- ✅ FIX: Add missing columns to visit_logs table
-- Issue: Code references 'servicesCount' and 'total_spent' but columns don't exist in schema cache

BEGIN;

-- Check if columns exist, add if missing
DO $$ 
BEGIN
  -- Add servicesCount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='servicesCount'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN "servicesCount" INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Added servicesCount column to visit_logs';
  ELSE
    RAISE NOTICE '✅ servicesCount column already exists';
  END IF;

  -- Add total_spent column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='total_spent'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN total_spent DECIMAL(10, 2) DEFAULT 0;
    RAISE NOTICE '✅ Added total_spent column to visit_logs';
  ELSE
    RAISE NOTICE '✅ total_spent column already exists';
  END IF;

  -- Add visitTime column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='visitTime'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN "visitTime" VARCHAR(5) DEFAULT '00:00';
    RAISE NOTICE '✅ Added visitTime column to visit_logs';
  ELSE
    RAISE NOTICE '✅ visitTime column already exists';
  END IF;

  -- Add notes column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='notes'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN notes TEXT;
    RAISE NOTICE '✅ Added notes column to visit_logs';
  ELSE
    RAISE NOTICE '✅ notes column already exists';
  END IF;

END $$;

-- Verify all columns now exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='visit_logs' 
ORDER BY ordinal_position;

COMMIT;
