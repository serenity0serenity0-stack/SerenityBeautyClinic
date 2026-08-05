-- ✅ INSERT SERENITY BEAUTY CLINIC INFO
-- اسم الـ Clinic: Serenity Beauty Clinic
-- الهاتف: 011 03032431
-- المطور: YoussefAhmed 01000139417

BEGIN;

-- 1️⃣ الحصول على clinic_id (استبدل بـ ID الفعلي إذا لزم الأمر)
-- استخدام أول clinic موجود أو أنشئ واحد جديد إذا لم تكن موجودة

DO $$
DECLARE
    clinic_id UUID;
    clinic_exists BOOLEAN;
BEGIN
    -- 1. تحقق إذا كان هناك clinic موجود
    SELECT EXISTS(SELECT 1 FROM clinic LIMIT 1) INTO clinic_exists;
    
    IF clinic_exists THEN
        -- تحديث الـ clinic الموجود
        UPDATE clinic 
        SET name = 'Serenity Beauty Clinic'
        WHERE id IN (
            SELECT id FROM clinic 
            WHERE name IS NOT NULL 
            LIMIT 1
        );
        
        RAISE NOTICE 'Updated existing clinic to Serenity Beauty Clinic';
    ELSE
        -- إنشاء clinic جديد
        INSERT INTO clinic (name)
        VALUES ('Serenity Beauty Clinic');
        
        RAISE NOTICE 'Created new clinic: Serenity Beauty Clinic';
    END IF;
    
    -- 2. إدراج settings للـ clinic
    -- الحصول على clinic_id
    SELECT id INTO clinic_id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1;
    
    IF clinic_id IS NOT NULL THEN
        -- تحديث أو إدراج معلومات الـ clinic
        INSERT INTO settings (key, value, clinic_id)
        VALUES 
            ('clinic_name', 'Serenity Beauty Clinic', clinic_id),
            ('clinic_phone', '011 03032431', clinic_id),
            ('developer_name', 'YoussefAhmed', clinic_id),
            ('developer_phone', '01000139417', clinic_id),
            ('clinic_address', 'Bak Abu Saud Street - El Dorado - 6th District', clinic_id),
            ('clinic_location', 'الدور السادس - بك سويف عبد السلام عارف - بك علي باي - الدور السادس', clinic_id)
        ON CONFLICT (key, clinic_id) 
        DO UPDATE SET value = EXCLUDED.value;
        
        RAISE NOTICE 'Inserted clinic settings for: %', clinic_id;
    END IF;
END $$;

-- 3️⃣ التحقق من البيانات
SELECT 
    tablename,
    rowsecurity as "RLS_Status"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clinic', 'settings')
ORDER BY tablename;

COMMIT;

-- ✅ تم إدراج معلومات Serenity Beauty Clinic
