-- ✅ حذف خدمة "حلاقة عادية" 
-- Delete "Regular Haircut" service

BEGIN;

-- حذف المتغيرات أولاً (اگر وجدت)
DELETE FROM service_variants 
WHERE service_id IN (
    SELECT id FROM services 
    WHERE clinic_id = (SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1)
    AND nameEn = 'Regular Haircut'
);

-- حذف الخدمة
DELETE FROM services 
WHERE clinic_id = (SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1)
AND nameEn = 'Regular Haircut';

COMMIT;

-- ✅ تحقق من النتيجة
SELECT 'Services after deletion:' as info;
SELECT nameAr, nameEn, COUNT(sv.id) as variants
FROM services s
LEFT JOIN service_variants sv ON s.id = sv.service_id
WHERE s.clinic_id = (SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1)
GROUP BY s.id, s.nameAr, s.nameEn
ORDER BY s.created_at;
