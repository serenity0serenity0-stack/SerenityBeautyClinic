-- ✅ INSERT SERENITY BEAUTY CLINIC SERVICES & PRICES
-- الخدمات من الصورة بالأسعار

BEGIN;

DO $$
DECLARE
    v_clinic_id UUID;
    v_service_id UUID;
BEGIN
    -- الحصول على clinic_id
    SELECT id INTO v_clinic_id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1;
    
    IF v_clinic_id IS NULL THEN
        RAISE EXCEPTION 'Clinic not found. Please run INSERT_CLINIC_INFO.sql first';
    END IF;
    
    -- ============================================
    -- 1️⃣ Waxing Services (الشمع - إزالة الشعر)
    -- ============================================
    
    -- Delete existing services to avoid duplicates
    DELETE FROM services WHERE services.clinic_id = v_clinic_id AND services.category IN ('hair', 'skincare');
    
    -- Hair Waxing - General (جلسات الفرد)
    INSERT INTO services (clinic_id, nameAr, nameEn, category, description, price)
    VALUES (v_clinic_id, 'جلسات الفرد', 'Full Body Waxing', 'skincare', '3-Session Waxing Package', 150)
    RETURNING id INTO v_service_id;
    
    INSERT INTO service_variants (clinic_id, service_id, name, price, duration, "isActive")
    VALUES 
        (v_clinic_id, v_service_id, '3 جلسات فرد', 250, 45, true),
        (v_clinic_id, v_service_id, '3 جلسات فرد ورقية', 300, 45, true),
        (v_clinic_id, v_service_id, '3 جلسات أندر آرم', 150, 30, true),
        (v_clinic_id, v_service_id, '3 جلسات بيكيني وبكيني لاين', 300, 45, true);
    
    -- Combined Waxing Packages (باقات مختلطة)
    INSERT INTO services (clinic_id, nameAr, nameEn, category, description, price)
    VALUES (v_clinic_id, 'باقات شمع مختلطة', 'Mixed Waxing Packages', 'skincare', 'Combined Waxing Packages', 350)
    RETURNING id INTO v_service_id;
    
    INSERT INTO service_variants (clinic_id, service_id, name, price, duration, "isActive")
    VALUES 
        (v_clinic_id, v_service_id, '3 جلسات بيكيني و3 بكيني لاين و3 أندرارم', 350, 60, true),
        (v_clinic_id, v_service_id, '3 جلسات هاف ارم', 600, 45, true),
        (v_clinic_id, v_service_id, '3 جلسات هاف ليج', 950, 60, true),
        (v_clinic_id, v_service_id, '3 جلسات فول ارم', 950, 60, true);
    
    -- Full Body Waxing (جلسات فول بدي)
    INSERT INTO services (clinic_id, nameAr, nameEn, category, description, price)
    VALUES (v_clinic_id, 'جلسات فول بدي', 'Full Body Sessions', 'skincare', 'Complete Body Hair Removal', 2200)
    RETURNING id INTO v_service_id;
    
    INSERT INTO service_variants (clinic_id, service_id, name, price, duration, "isActive")
    VALUES 
        (v_clinic_id, v_service_id, '3 جلسات فول ليج', 2200, 90, true),
        (v_clinic_id, v_service_id, '3 جلسات فول بدي', 3500, 120, true),
        (v_clinic_id, v_service_id, '3 جلسات فول بدي بالبطن والظهر', 4500, 120, true);
    
    -- ============================================
    -- 2️⃣ Threading Services (التشقير)
    -- ============================================
    
    INSERT INTO services (clinic_id, nameAr, nameEn, category, description, price)
    VALUES (v_clinic_id, 'تشقير', 'Threading', 'skincare', 'Threading Service Packages', 400)
    RETURNING id INTO v_service_id;
    
    INSERT INTO service_variants (clinic_id, service_id, name, price, duration, "isActive")
    VALUES 
        (v_clinic_id, v_service_id, '1000 نيشة + 100 نيشه هديه', 400, 30, true),
        (v_clinic_id, v_service_id, '2000 نيشه + 300+ نيشه هديه', 750, 45, true),
        (v_clinic_id, v_service_id, '3000 نيشه + 200 نيشه', 1100, 60, true),
        (v_clinic_id, v_service_id, '6000 نيشه + 300 نيشه هديه', 1900, 90, true);
    
    RAISE NOTICE 'Successfully inserted all services and variants for Serenity Beauty Clinic';
END $$;

-- ✅ تحقق من البيانات
SELECT 
    s.nameAr,
    s.nameEn,
    COUNT(sv.id) as variant_count,
    MIN(sv.price)::INT as min_price,
    MAX(sv.price)::INT as max_price
FROM services s
LEFT JOIN service_variants sv ON s.id = sv.service_id
WHERE s.clinic_id = (SELECT id FROM clinic WHERE name = 'Serenity Beauty Clinic' LIMIT 1)
GROUP BY s.id, s.nameAr, s.nameEn
ORDER BY s.created_at;

COMMIT;

-- ✅ تم إدراج جميع الخدمات والأسعار
