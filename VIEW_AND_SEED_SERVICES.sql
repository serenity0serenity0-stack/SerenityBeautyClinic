-- ============================================================================
-- 1) VIEW ALL SERVICES WITH PRICES (+ package columns)
-- Run this first: see what you have before re-seeding.
-- ============================================================================

-- All services (regular + packages)
SELECT s.id,
       s."nameAr"                                AS service_ar,
       s."nameEn"                                AS service_en,
       s.price                                   AS price_egp,
       s.category,
       s.active,
       s.service_type,          -- regular | package
       s.unit_label,            -- نبضة / جلسة / ...
       s.package_quantity,      -- عدد الوحدات المدفوعة (افتراضي للخدمة)
       s.bonus_quantity,        -- البونص (افتراضي للخدمة)
       s.expiry_value || ' ' || COALESCE(s.expiry_unit, '') AS expiry
  FROM services s
 ORDER BY s.category, s."nameAr";

-- All variants WITH the variant-level package fields
-- (variant fields override the service fields when set)
SELECT sv.service_id,
       s."nameAr"                                   AS service_ar,
       sv.name                                      AS variant_name,
       sv.price                                     AS variant_price_egp,
       COALESCE(sv.service_type, s.service_type)    AS effective_type,
       COALESCE(sv.unit_label, s.unit_label)        AS unit_label,
       COALESCE(sv.package_quantity, s.package_quantity) AS qty,
       COALESCE(sv.bonus_quantity, s.bonus_quantity)     AS bonus,
       COALESCE(sv.expiry_value, s.expiry_value) || ' ' ||
         COALESCE(COALESCE(sv.expiry_unit, s.expiry_unit), '') AS expiry,
       sv.isActive
  FROM service_variants sv
  JOIN services s ON s.id = sv.service_id
 ORDER BY s."nameAr", sv.name;

-- ============================================================================
-- 2) APPLY THE REAL CATALOG TO THE NEW MODEL
--    ✏️ Upsert-style: updates existing rows, never duplicates.
--    ✏️ Matches the catalog you pasted. Run it once.
-- ============================================================================

DO $$
DECLARE
  v_clinic_id UUID := (SELECT id FROM clinic ORDER BY created_at LIMIT 1);
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد (clinic) في القاعدة — أنشئ العيادة أولاً';
  END IF;

  -- ==================================================================
  -- A) MASTER SERVICES
  -- ==================================================================

  -- نبضات → باقة: تُضاف للرصيد وتُستهلك بعد الجلسة عند الدكتور
  UPDATE services SET service_type = 'package',
                      unit_label   = 'نبضة',
                      package_quantity = 1000,
                      bonus_quantity   = 150,
                      expiry_value = 1,
                      expiry_unit  = 'months',
                      category     = 'pulses',
                      price        = CASE WHEN price = 0 THEN 400 ELSE price END,
                      nameEn       = 'Pulses',
                      updated_at   = NOW()
   WHERE clinic_id = v_clinic_id AND "nameAr" = 'نبضات';

  -- "4 sessions" → باقة جلسات (كل Variant لمنطقة، باقة 4 جلسات)
  UPDATE services SET service_type = 'package',
                      unit_label   = 'جلسة',
                      package_quantity = 4,
                      bonus_quantity   = 0,
                      expiry_value = 1,
                      expiry_unit  = 'months',
                      updated_at   = NOW()
   WHERE clinic_id = v_clinic_id AND "nameAr" = '4 sessions';

  -- جلسات (سنجل لكل منطقة) / تنضيف / خدمات اخري → خدمات عادية (تُباع مرة واحدة)
  UPDATE services SET service_type = 'regular',
                      unit_label = NULL,
                      package_quantity = NULL,
                      bonus_quantity = 0,
                      expiry_value = NULL,
                      expiry_unit = NULL,
                      updated_at = NOW()
   WHERE clinic_id = v_clinic_id AND "nameAr" IN ('جلسات', 'تنضيف', 'خدمات اخري');

  -- ==================================================================
  -- B) النبضات — كل باقة في Variant لها كميتها وبونصها الخاص
  -- ==================================================================
  UPDATE service_variants sv
     SET service_type = 'package',
         unit_label = 'نبضة',
         expiry_value = 1,
         expiry_unit = 'months',
         package_quantity = m.qty,
         bonus_quantity   = m.bonus
    FROM services s,
         (VALUES
      ('1000 نبضه + 100 نبضه هديه',  1000, 100),
      ('1000 نبضه + 150نبضه هديه',   1000, 150),
      ('2300 نبضه + 100 نبضه هديه',  2300, 100),
      ('5100 نبضه + 1000 نبضه هديه', 5100, 1000),
      ('7000نبضه + 1000 نبضه هديه',  7000, 1000)
         ) AS m(vname, qty, bonus)
   WHERE s.id = sv.service_id
     AND sv.name = m.vname
     AND s.clinic_id = v_clinic_id
     AND s."nameAr" = 'نبضات';

  -- ==================================================================
  -- C) "4 sessions" — كل الـ Variants باقة 4 جلسات
  -- ==================================================================
  UPDATE service_variants sv
     SET service_type = 'package',
         unit_label = 'جلسة',
         package_quantity = 4,
         bonus_quantity = 0,
         expiry_value = 1,
         expiry_unit = 'months'
    FROM services s
   WHERE s.id = sv.service_id AND s.clinic_id = v_clinic_id AND s."nameAr" = '4 sessions';

  -- ==================================================================
  -- D) خدمات عادية — الـ Variants بلا كميات (سعر الجلسة فقط)
  -- ==================================================================
  UPDATE service_variants sv
     SET service_type = 'regular',
         unit_label = NULL,
         package_quantity = NULL,
         bonus_quantity = 0,
         expiry_value = NULL,
         expiry_unit = NULL
    FROM services s
   WHERE s.id = sv.service_id AND s.clinic_id = v_clinic_id
     AND s."nameAr" IN ('جلسات', 'تنضيف', 'خدمات اخري');

  -- ==================================================================
  -- E) "6بكيني و بكيني لاين و اندر ارم" في جلسات → باقة 6 جلسات
  -- ==================================================================
  UPDATE service_variants sv
     SET service_type = 'package',
         unit_label = 'جلسة',
         package_quantity = 6,
         bonus_quantity = 0,
         expiry_value = 1,
         expiry_unit = 'months'
    FROM services s
   WHERE s.id = sv.service_id AND s.clinic_id = v_clinic_id
     AND s."nameAr" = 'جلسات'
     AND sv.name = '6بكيني و بكيني لاين و اندر ارم';

  RAISE NOTICE '✅ تم تطبيق الكتالوج الجديد على العيادة %', v_clinic_id;
END $$;

-- ============================================================================
-- 3) VERIFY — بعد التطبيق شغّل استعلام الـ Variants العلوي
--    وشوف عمود effective_type / qty / bonus = الإعداد النهائي لكل باقة
-- ============================================================================