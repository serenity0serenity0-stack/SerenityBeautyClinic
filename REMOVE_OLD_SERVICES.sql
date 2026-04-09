-- ✅ REMOVE OLD BARBERSHOP SERVICES
-- Removing: قص الشعر (Haircut), تشذيب اللحية (Beard), أطفال (Kids)
-- These are being replaced with beauty clinic services

BEGIN;

-- Get clinic ID
WITH clinic_data AS (
  SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1
)

-- Delete service variants first (they reference services)
DELETE FROM service_variants 
WHERE service_id IN (
  SELECT id FROM services 
  WHERE clinic_id = (SELECT id FROM clinic_data)
    AND (nameEn = 'Haircut' 
         OR nameEn = 'Beard Trim'
         OR nameEn = 'Kids Services'
         OR nameEn = 'Kids')
);

-- Delete the services
DELETE FROM services
WHERE clinic_id = (SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1)
  AND (nameEn = 'Haircut' 
       OR nameEn = 'Beard Trim'
       OR nameEn = 'Kids Services'
       OR nameEn = 'Kids');

COMMIT;

-- ✅ Verify removal
SELECT 
  s.id,
  s.nameAr,
  s.nameEn,
  COUNT(sv.id) as variant_count
FROM services s
LEFT JOIN service_variants sv ON s.id = sv.service_id
WHERE s.clinic_id = (SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1)
GROUP BY s.id, s.nameAr, s.nameEn
ORDER BY s.created_at;
