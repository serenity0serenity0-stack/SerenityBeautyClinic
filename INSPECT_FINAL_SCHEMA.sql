-- ✅ فحص شامل للـ Database
-- Comprehensive Database Inspection

-- 1️⃣ تحقق من جدول clinic
SELECT '=== CLINIC TABLE ===' as info;
SELECT * FROM clinic LIMIT 5;

-- 2️⃣ تحقق من هيكل جدول services
SELECT '=== SERVICES TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;

-- 3️⃣ اعرض البيانات الموجودة في services
SELECT '=== EXISTING SERVICES DATA ===' as info;
SELECT id, clinic_id, nameAr, nameEn, price, category, created_at FROM services LIMIT 10;

-- 4️⃣ تحقق من هيكل جدول service_variants
SELECT '=== SERVICE_VARIANTS TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'service_variants' 
ORDER BY ordinal_position;

-- 5️⃣ اعرض البيانات الموجودة في service_variants
SELECT '=== EXISTING SERVICE_VARIANTS DATA ===' as info;
SELECT id, clinic_id, service_id, name, price, duration FROM service_variants LIMIT 10;

-- 6️⃣ عد الخدمات والمتغيرات
SELECT '=== DATA COUNT ===' as info;
SELECT 
    'Total Clinics' as metric, COUNT(*) as count FROM clinic
UNION ALL
SELECT 'Total Services', COUNT(*) FROM services
UNION ALL
SELECT 'Total Service Variants', COUNT(*) FROM service_variants;

-- 7️⃣ عد الخدمات حسب clinic_id
SELECT '=== SERVICES BY CLINIC ===' as info;
SELECT 
    c.name as clinic_name,
    COUNT(s.id) as service_count
FROM clinic c
LEFT JOIN services s ON c.id = s.clinic_id
GROUP BY c.id, c.name;
