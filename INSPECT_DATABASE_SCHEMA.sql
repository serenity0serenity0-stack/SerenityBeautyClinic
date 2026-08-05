-- ✅ INSPECT CURRENT DATABASE SCHEMA
-- هذا الـ script يعرض:
-- 1. جميع الجداول والـ columns
-- 2. البيانات الحالية
-- 3. أي حاجة اسمها محتاج يتغير

-- ============================================
-- 1️⃣ عرض جميع الجداول والـ columns
-- ============================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================
-- 2️⃣ عرض أي جدول فيه 'shop_id' (محتاج يتغير)
-- ============================================
SELECT DISTINCT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%shop%'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

-- ============================================
-- 3️⃣ عرض أي جدول فيه 'clinic_id' (الصح)
-- ============================================
SELECT DISTINCT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%clinic%'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

-- ============================================
-- 4️⃣ عرض حالة RLS (Row Level Security)
-- ============================================
SELECT 
  t.tablename as "Table_Name",
  t.rowsecurity as "RLS_Enabled"
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;

-- ============================================
-- 5️⃣ عرض عدد الصفوف في كل جدول
-- ============================================
SELECT 
  schemaname as "Schema",
  relname as "Table_Name",
  n_live_tup as "Row_Count"
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================
-- 6️⃣ عرض جميع الـ foreign keys والعلاقات
-- ============================================
SELECT
  kcu.table_name,
  kcu.column_name,
  ccu.table_name AS "Referenced_Table",
  ccu.column_name AS "Referenced_Column"
FROM information_schema.key_column_usage AS kcu
  JOIN information_schema.constraint_column_usage AS ccu
    ON kcu.constraint_name = ccu.constraint_name
WHERE kcu.table_schema = 'public'
ORDER BY kcu.table_name;

-- ============================================
-- 7️⃣ عرض أمثلة من البيانات (أول 3 صفوف من كل جدول)
-- ============================================
-- ملاحظة: شغل هذا بحذر - قد يكون كمية كبيرة من البيانات

-- admin_auth
SELECT '--- admin_auth ---' as "Table";
SELECT * FROM admin_auth LIMIT 3;

-- clinic
SELECT '--- clinic ---' as "Table";
SELECT * FROM clinic LIMIT 3;

-- clients
SELECT '--- clients ---' as "Table";
SELECT * FROM clients LIMIT 3;

-- barbers
SELECT '--- barbers ---' as "Table";
SELECT * FROM barbers LIMIT 3;

-- services
SELECT '--- services ---' as "Table";
SELECT * FROM services LIMIT 3;

-- bookings
SELECT '--- bookings ---' as "Table";
SELECT * FROM bookings LIMIT 3;

-- transactions
SELECT '--- transactions ---' as "Table";
SELECT * FROM transactions LIMIT 3;

-- visit_logs
SELECT '--- visit_logs ---' as "Table";
SELECT * FROM visit_logs LIMIT 3;

-- ============================================
-- 8️⃣ تقرير شامل: ما الذي يحتاج التغيير؟
-- ============================================
WITH problem_columns AS (
  SELECT 
    table_name,
    string_agg(column_name, ', ') as "Problematic_Columns"
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (column_name LIKE '%shop%'
      OR column_name LIKE '%barber%' AND column_name != 'barber_id'
      OR column_name LIKE '%therapist%')
  GROUP BY table_name
)
SELECT
  table_name as "Table_Name",
  "Problematic_Columns",
  CASE 
    WHEN "Problematic_Columns" LIKE '%shop_id%' THEN 'اسم shop_id اتغير الى clinic_id'
    WHEN "Problematic_Columns" LIKE '%barber%' THEN 'تحقق من naming convention'
    WHEN "Problematic_Columns" LIKE '%therapist%' THEN 'تحقق من naming convention'
    ELSE 'احتاج review'
  END as "Recommendation"
FROM problem_columns
ORDER BY table_name;
