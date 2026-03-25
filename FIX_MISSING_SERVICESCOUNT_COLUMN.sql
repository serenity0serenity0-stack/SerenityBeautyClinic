-- ✅ FIX: Add missing servicesCount column to visit_logs table
-- Issue: Code references 'servicesCount' but column doesn't exist in schema cache

BEGIN;

-- Check if column exists, add if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='servicesCount'
  ) THEN
    ALTER TABLE visit_logs ADD COLUMN "servicesCount" INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Added servicesCount column to visit_logs';
  ELSE
    RAISE NOTICE '✅ servicesCount column already exists';
  END IF;
END $$;

-- Verify the column now exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='visit_logs' 
ORDER BY ordinal_position;

COMMIT;
