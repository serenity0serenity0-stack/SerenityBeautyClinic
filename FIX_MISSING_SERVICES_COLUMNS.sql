-- ✅ FIX: Add missing columns to services table
-- Issue: Code references 'nameAr' and 'nameEn' but columns don't exist in schema cache

BEGIN;

-- Check if columns exist, add if missing
DO $$ 
BEGIN
  -- Add nameAr column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='nameAr'
  ) THEN
    ALTER TABLE services ADD COLUMN "nameAr" VARCHAR(255);
    RAISE NOTICE '✅ Added nameAr column to services';
  ELSE
    RAISE NOTICE '✅ nameAr column already exists';
  END IF;

  -- Add nameEn column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='nameEn'
  ) THEN
    ALTER TABLE services ADD COLUMN "nameEn" VARCHAR(255);
    RAISE NOTICE '✅ Added nameEn column to services';
  ELSE
    RAISE NOTICE '✅ nameEn column already exists';
  END IF;

  -- Add category column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='category'
  ) THEN
    ALTER TABLE services ADD COLUMN category VARCHAR(100);
    RAISE NOTICE '✅ Added category column to services';
  ELSE
    RAISE NOTICE '✅ category column already exists';
  END IF;

  -- Add active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='active'
  ) THEN
    ALTER TABLE services ADD COLUMN active BOOLEAN DEFAULT true;
    RAISE NOTICE '✅ Added active column to services';
  ELSE
    RAISE NOTICE '✅ active column already exists';
  END IF;

  -- Add duration column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='duration'
  ) THEN
    ALTER TABLE services ADD COLUMN duration INT DEFAULT 30;
    RAISE NOTICE '✅ Added duration column to services';
  ELSE
    RAISE NOTICE '✅ duration column already exists';
  END IF;

  -- Add description column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='description'
  ) THEN
    ALTER TABLE services ADD COLUMN description TEXT;
    RAISE NOTICE '✅ Added description column to services';
  ELSE
    RAISE NOTICE '✅ description column already exists';
  END IF;

  -- Add image_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='services' AND column_name='image_url'
  ) THEN
    ALTER TABLE services ADD COLUMN image_url VARCHAR(500);
    RAISE NOTICE '✅ Added image_url column to services';
  ELSE
    RAISE NOTICE '✅ image_url column already exists';
  END IF;

END $$;

-- Verify all columns now exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='services' 
ORDER BY ordinal_position;

COMMIT;
