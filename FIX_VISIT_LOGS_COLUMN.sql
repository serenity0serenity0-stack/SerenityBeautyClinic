-- ✅ FIX visit_logs.shop_id → visit_logs.clinic_id
-- Fix the visit_logs table column name

BEGIN;

-- Check current structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'visit_logs'
ORDER BY ordinal_position;

-- Rename shop_id to clinic_id if it exists
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='visit_logs' AND column_name='shop_id') THEN
    ALTER TABLE visit_logs RENAME COLUMN shop_id TO clinic_id;
    RAISE NOTICE 'visit_logs: Renamed shop_id → clinic_id ✅';
  ELSE
    RAISE NOTICE 'visit_logs: shop_id column does not exist (already named clinic_id?) ✅';
  END IF;
END $$;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'visit_logs'
ORDER BY ordinal_position;

-- Show sample data
SELECT id, clinic_id, client_id, visitDate, visitTime FROM visit_logs LIMIT 3;

COMMIT;
