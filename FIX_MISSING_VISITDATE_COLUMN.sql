-- ✅ FIX: Add DEFAULT CURRENT_DATE to visit_date and visitDate columns
-- These columns were created without defaults, causing NOT NULL constraint issues

BEGIN;

-- Add DEFAULT CURRENT_DATE to visit_date column
ALTER TABLE visit_logs 
ALTER COLUMN visit_date SET DEFAULT CURRENT_DATE;

-- Add DEFAULT CURRENT_DATE to visitDate column  
ALTER TABLE visit_logs
ALTER COLUMN "visitDate" SET DEFAULT CURRENT_DATE;

-- Verify defaults are set
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name='visit_logs' 
AND column_name IN ('visit_date', 'visitDate', 'clinic_id', 'client_id', 'visitTime', 'servicesCount', 'total_spent')
ORDER BY ordinal_position;

COMMIT;
