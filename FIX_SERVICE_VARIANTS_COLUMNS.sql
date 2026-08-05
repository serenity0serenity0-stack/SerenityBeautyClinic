-- ✅ FINAL FIX: service_variants COLUMN CLEANUP
-- Remove duplicate/conflicting columns and ensure consistency

BEGIN;

-- ============================================
-- 1️⃣ Check existing columns
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_variants' 
ORDER BY ordinal_position;

-- ============================================
-- 2️⃣ Drop old/conflicting columns if they exist
-- ============================================

-- Drop serviceId if it exists (wrong name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='service_variants' AND column_name='serviceId'
  ) THEN
    ALTER TABLE service_variants DROP COLUMN "serviceId";
    RAISE NOTICE 'Dropped serviceId column';
  END IF;
END $$;

-- Drop isactive if it exists (lowercase version)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='service_variants' AND column_name='isactive'
  ) THEN
    ALTER TABLE service_variants DROP COLUMN isactive;
    RAISE NOTICE 'Dropped isactive column';
  END IF;
END $$;

-- ============================================
-- 3️⃣ Ensure isActive exists (correct name)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='service_variants' AND column_name='isActive'
  ) THEN
    ALTER TABLE service_variants ADD COLUMN "isActive" BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added isActive column';
  END IF;
END $$;

-- ============================================
-- 4️⃣ Verify final schema
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'service_variants' 
ORDER BY ordinal_position;

COMMIT;

-- ✅ service_variants schema cleaned up
