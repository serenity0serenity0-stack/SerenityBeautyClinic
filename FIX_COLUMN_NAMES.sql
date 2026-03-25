-- ✅ FIX ALL COLUMN NAME MISMATCHES
-- Corrects:
-- 1. visit_logs: shop_id → clinic_id
-- 2. service_variants: serviceId → service_id (if exists)
-- 3. service_variants: isActive (should exist)

BEGIN;

-- ============================================
-- 1️⃣ Fix visit_logs column names
-- ============================================

-- Check if visit_logs has shop_id, rename to clinic_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='visit_logs' AND column_name='shop_id'
  ) THEN
    ALTER TABLE visit_logs RENAME COLUMN shop_id TO clinic_id;
    RAISE NOTICE 'visit_logs: Renamed shop_id → clinic_id';
  END IF;
END $$;

-- ============================================
-- 2️⃣ Fix service_variants column names
-- ============================================

-- Check if service_variants has serviceId (camelCase), rename to service_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='service_variants' AND column_name='serviceId'
  ) THEN
    ALTER TABLE service_variants RENAME COLUMN "serviceId" TO service_id;
    RAISE NOTICE 'service_variants: Renamed serviceId → service_id';
  END IF;
END $$;

-- Check if service_variants has missing isActive, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='service_variants' AND column_name='isActive'
  ) THEN
    ALTER TABLE service_variants ADD COLUMN "isActive" BOOLEAN DEFAULT true;
    RAISE NOTICE 'service_variants: Added isActive column';
  END IF;
END $$;

-- ============================================
-- 3️⃣ Verify all columns are correct
-- ============================================
SELECT 
  table_name,
  string_agg(column_name, ', ') as "Column Names"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('visit_logs', 'service_variants')
GROUP BY table_name
ORDER BY table_name;

COMMIT;

-- ✅ All column names corrected
