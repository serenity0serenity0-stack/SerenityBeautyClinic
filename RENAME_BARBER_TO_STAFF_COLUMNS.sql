-- ✅ إعادة تسمية barber_name → staff_name
-- لتتطابق مع تغيير مصطلح "barber" الى "staff" في التطبيق

BEGIN;

-- ============================================
-- 1️⃣ جدول bookings
-- ============================================
ALTER TABLE IF EXISTS bookings
RENAME COLUMN IF EXISTS barber_name TO staff_name;

-- ============================================
-- 2️⃣ جدول transactions
-- ============================================
ALTER TABLE IF EXISTS transactions
RENAME COLUMN IF EXISTS barber_name TO staff_name;

-- ============================================
-- 3️⃣ التحقق من الآخر
-- ============================================
SELECT 
  table_name,
  string_agg(column_name, ', ') as "Renamed_Columns"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%staff%'
GROUP BY table_name
ORDER BY table_name;

COMMIT;

-- ✅ تم إعادة تسمية جميع الأعمدة بنجاح - الآن كل شيء متسق
