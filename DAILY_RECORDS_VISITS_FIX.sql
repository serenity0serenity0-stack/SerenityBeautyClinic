-- ============================================================================
-- DAILY RECORDS: VISITS FIX + ACTIVITY SEPARATION
-- ============================================================================
-- ROOT CAUSE FIXED:
--   complete_sale used to INSERT a visit_logs row for EVERY sale — even a pure
--   purchase (p_mark_done=false) that only adds balance.  Meanwhile real usage
--   (consume_service -> service_consumptions) created NO visit record at all.
--   So the Daily Logs "visits" tab showed purchase-records-as-visits and double
--   counted sales as visits, while actual performed sessions never appeared.
--
-- FIX (matches product decision: "استهلاك الرصيد = الزيارة"):
--   1. complete_sale writes a visit_logs row ONLY when the service is being
--      performed now (p_mark_done = true). A purchase-only sale writes NO visit.
--   2. consume_service / _consume_from_balance ALWAYS write a real visit_logs
--      row (a balance-based visit) with balance-before / balance-after, the
--      service identity, and optional doctor/employee.
--   3. consume_service becomes variant-aware so distinct service identities
--      (e.g. 4 Half Arm vs 4 Leg) never get mixed when consuming balance.
--   4. New columns on service_consumptions/balance_adjustments to preserve the
--      precise service identity (variant_id) — mirroring service_purchases.
--   5. New columns on visit_logs to carry visit detail (service, doctor,
--      employee, purchase ref, balance before/after) for the Daily Records UI.
--
-- Safe to run multiple times (idempotent).  Run AFTER SERP_DISTINCT_BALANCES_AND_SEARCH.sql.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) service_consumptions: add variant_id (identity parity with purchases)
-- ----------------------------------------------------------------------------
ALTER TABLE service_consumptions ADD COLUMN IF NOT EXISTS variant_id UUID;
CREATE INDEX IF NOT EXISTS idx_service_consumptions_variant_id ON service_consumptions(variant_id);

-- ----------------------------------------------------------------------------
-- 2) balance_adjustments: add variant_id (identity parity)
-- ----------------------------------------------------------------------------
ALTER TABLE balance_adjustments ADD COLUMN IF NOT EXISTS variant_id UUID;
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_variant_id ON balance_adjustments(variant_id);

-- ----------------------------------------------------------------------------
-- 3) visit_logs: extend with visit detail used by the Daily Records UI
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Baseline columns (safely added if the live schema drifted / is missing them)
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS clinic_id    UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS client_id    UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS client_name  VARCHAR(255);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS booking_id   UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS barber_id    UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS service_type VARCHAR(100);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS "visitDate"  DATE;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS visit_date   DATE;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS "visitTime"  VARCHAR(5);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS servicesCount INTEGER DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS total_spent  NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS notes        TEXT;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS duration     INT DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS amount       NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS visit_number INT;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

  -- New detailed columns for the Daily Records UI
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS service_id  UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS variant_id  UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS service_name VARCHAR(255);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS unit_label  VARCHAR(20);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS purchase_id UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS quantity    INT DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS balance_before INT DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS balance_after  INT DEFAULT 0;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS doctor_id  UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS employee_id UUID;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS start_time TEXT;
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS end_time   TEXT;
  -- 'consumption' = session/pulse used from balance ; 'service' = one-time
  -- service performed at sale time (mark_done) ; 'sale' = legacy
  ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS visit_type  VARCHAR(20) DEFAULT 'service';
END $$;

CREATE INDEX IF NOT EXISTS idx_visit_logs_service_id   ON visit_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_purchase_id  ON visit_logs(purchase_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_visit_type   ON visit_logs(visit_type);

-- Commit schema changes NOW so the visit_date column survives even if a
-- function DDL below fails (otherwise the whole single transaction rolls back
-- and the cashier keeps failing with "column visit_date does not exist").
COMMIT;

BEGIN;

-- ----------------------------------------------------------------------------
-- 3b) Drop all old function signatures before CREATE, because Postgres cannot
--     CREATE OR REPLACE a function whose parameter list changed (old
--     consume_service/_consume_from_balance had 5 args, new ones have 8).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public._consume_from_balance(UUID, UUID, UUID, INT, TEXT);
DROP FUNCTION IF EXISTS public._consume_from_balance(UUID, UUID, UUID, INT, TEXT, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.consume_service(UUID, UUID, UUID, INT, TEXT);
DROP FUNCTION IF EXISTS public.consume_service(UUID, UUID, UUID, INT, TEXT, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT, BOOLEAN);

-- ----------------------------------------------------------------------------
-- 4) _consume_from_balance : write a REAL visit + variant-aware consumption
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._consume_from_balance(
  p_client_id UUID,
  p_clinic_id UUID,
  p_service_id UUID,
  p_quantity INT,
  p_note TEXT,
  p_variant_id UUID DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INT := p_quantity;
  v_today DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::date;
  v_now   TIMESTAMP := NOW() AT TIME ZONE 'Africa/Cairo';
  v_purchase RECORD;
  v_used INT;
  v_total_used INT := 0;
  v_balance_before INT := 0;
  v_balance_after INT := 0;
  v_service_name VARCHAR;
  v_unit VARCHAR;
  v_first_purchase_id UUID;
  v_first_service_name VARCHAR;
  v_first_unit VARCHAR;
  v_doctor_name VARCHAR;
  v_employee_name VARCHAR;
  v_svc RECORD;
BEGIN
  IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'الكمية غير صالحة'; END IF;

  SELECT id, nameAr, name INTO v_svc FROM services
   WHERE id = p_service_id AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'خدمة غير موجودة'; END IF;
  v_service_name := COALESCE(v_svc.nameAr, v_svc.name, 'خدمة');

  IF p_doctor_id IS NOT NULL THEN
    SELECT name INTO v_doctor_name FROM barbers
     WHERE id = p_doctor_id AND clinic_id = p_clinic_id;
  END IF;
  IF p_employee_id IS NOT NULL THEN
    SELECT name INTO v_employee_name FROM admin_auth
     WHERE auth_user_id = p_employee_id AND clinic_id = p_clinic_id;
  END IF;

  -- Expire stale purchases first
  UPDATE service_purchases SET status = 'expired', updated_at = NOW()
   WHERE clinic_id = p_clinic_id AND client_id = p_client_id
     AND service_id = p_service_id
     AND (p_variant_id IS NULL OR variant_id = p_variant_id)
     AND (p_variant_id IS NOT NULL OR variant_id IS NULL)
     AND status = 'active' AND remaining_quantity > 0
     AND expiry_date IS NOT NULL AND expiry_date < v_today;

  -- Total available before (same identity: variant-aware, or parent-level)
  SELECT COALESCE(SUM(remaining_quantity), 0)
    INTO v_balance_before
    FROM service_purchases
   WHERE clinic_id = p_clinic_id AND client_id = p_client_id
     AND service_id = p_service_id AND status = 'active' AND remaining_quantity > 0
     AND (p_variant_id IS NULL OR variant_id = p_variant_id)
     AND (p_variant_id IS NOT NULL OR variant_id IS NULL);

  -- Consume earliest expiry first; variant-aware so identities never mix
  FOR v_purchase IN
    SELECT sp.id, sp.remaining_quantity, sp.expiry_date, sp.unit_label,
           sp.transaction_id, sp.service_name,
           COALESCE(s."nameAr", s.name, sp.service_name) AS svc_name
      FROM service_purchases sp
      LEFT JOIN services s ON s.id = sp.service_id
     WHERE sp.clinic_id = p_clinic_id AND sp.client_id = p_client_id
       AND sp.service_id = p_service_id
       AND (p_variant_id IS NULL OR sp.variant_id = p_variant_id)
       AND (p_variant_id IS NOT NULL OR sp.variant_id IS NULL)
       AND sp.status = 'active' AND sp.remaining_quantity > 0
     ORDER BY sp.expiry_date ASC NULLS LAST, sp.created_at ASC
    FOR UPDATE OF sp
  LOOP
    IF v_qty <= 0 THEN EXIT; END IF;

    v_used := LEAST(v_purchase.remaining_quantity, v_qty);

    UPDATE service_purchases
       SET remaining_quantity = remaining_quantity - v_used,
           status = CASE WHEN remaining_quantity - v_used = 0 THEN 'fully_used' ELSE 'active' END,
           updated_at = NOW()
     WHERE id = v_purchase.id;

    INSERT INTO service_consumptions (
      clinic_id, client_id, purchase_id, service_id, variant_id, service_name,
      unit_label, quantity, note, created_by
    ) VALUES (
      p_clinic_id, p_client_id, v_purchase.id, p_service_id, p_variant_id,
      COALESCE(v_purchase.svc_name, v_service_name), v_purchase.unit_label,
      v_used, p_note, auth.uid()
    );

    IF v_first_purchase_id IS NULL THEN
      v_first_purchase_id := v_purchase.id;
      v_first_service_name := COALESCE(v_purchase.svc_name, v_service_name);
      v_first_unit := v_purchase.unit_label;
    END IF;

    v_total_used := v_total_used + v_used;
    v_qty := v_qty - v_used;
  END LOOP;

  IF v_qty > 0 THEN
    RAISE EXCEPTION 'الرصيد غير كافٍ. المتاح: % المطلوب: %', p_quantity - v_qty, p_quantity;
  END IF;

  v_balance_after := GREATEST(v_balance_before - v_total_used, 0);

  -- Write a REAL visit record (balance used = a visit)
  INSERT INTO visit_logs (
    clinic_id, client_id, booking_id, barber_id, service_type,
    service_id, variant_id, service_name, unit_label, purchase_id,
    quantity, balance_before, balance_after,
    doctor_id, doctor_name, employee_id, employee_name,
    "visitDate", visit_date, "visitTime", servicesCount, total_spent,
    start_time, end_time, notes, visit_type, duration, amount,
    visit_number, created_at, updated_at
  ) VALUES (
    p_clinic_id, p_client_id, NULL, p_doctor_id, COALESCE(v_first_service_name, v_service_name),
    p_service_id, p_variant_id, COALESCE(v_first_service_name, v_service_name),
    v_first_unit, v_first_purchase_id,
    v_total_used, v_balance_before, v_balance_after,
    p_doctor_id, v_doctor_name, p_employee_id, v_employee_name,
    v_today, v_today, to_char(v_now, 'HH24:MI'),
    1, 0,
    to_char(v_now, 'HH24:MI'), NULL, COALESCE(p_note, 'صرف رصيد'), 'consumption', 0, 0,
    COALESCE((SELECT MAX(visit_number)+1 FROM visit_logs WHERE client_id = p_client_id AND clinic_id = p_clinic_id), 1),
    NOW(), NOW()
  );

  RETURN v_total_used;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) consume_service : public API, now variant-aware, writes a real visit
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_service(
  p_client_id UUID,
  p_clinic_id UUID,
  p_service_id UUID,
  p_quantity INT,
  p_note TEXT DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_exists INT;
BEGIN
  SELECT COUNT(*) INTO v_service_exists FROM services
   WHERE id = p_service_id AND clinic_id = p_clinic_id;
  IF v_service_exists = 0 THEN RAISE EXCEPTION 'خدمة غير موجودة'; END IF;

  RETURN public._consume_from_balance(
    p_client_id, p_clinic_id, p_service_id, p_quantity, p_note,
    p_variant_id, p_doctor_id, p_employee_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) complete_sale : write a visit ONLY when the service is performed now
--    (mark_done = true). Purchase-only sales create NO visit.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_sale(
  p_client_id UUID, p_clinic_id UUID, p_items JSONB,
  p_discount DECIMAL DEFAULT 0, p_discount_type VARCHAR DEFAULT 'fixed',
  p_payment_method VARCHAR DEFAULT 'cash', p_barber_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL, p_mark_done BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_booking_id UUID;
  v_service RECORD;
  v_variant RECORD;
  v_line RECORD;
  v_subtotal DECIMAL := 0;
  v_discount_amount DECIMAL := 0;
  v_total DECIMAL := 0;
  v_tx_id UUID;
  v_vt_id UUID;
  v_barber_name VARCHAR;
  v_amount DECIMAL;
  v_invoice_no BIGINT;
  v_items_json JSONB := '[]'::jsonb;
  v_purchase_ids JSONB;
  v_date DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::date;
  v_time TIMESTAMP := NOW() AT TIME ZONE 'Africa/Cairo';
  v_visit_number INT;
  v_is_completed BOOLEAN;
  v_item_count INT;
  v_qty INT := 1;
  v_price DECIMAL := 0;
  v_name VARCHAR;
  v_type VARCHAR;
  v_unit VARCHAR;
  v_pkg_qty INT;
  v_bonus INT;
  v_exp_val INT;
  v_exp_unit VARCHAR;
  v_expiry DATE;
  v_line_total DECIMAL;
  i INT;
BEGIN
  PERFORM 1 FROM admin_auth WHERE auth_user_id = auth.uid() AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'غير مصرح لهذه العيادة'; END IF;

  IF (p_client_id IS NULL OR p_clinic_id IS NULL) THEN
    RAISE EXCEPTION 'تأكد من بيانات العميل والعيادة';
  END IF;
  IF (p_items IS NULL OR jsonb_array_length(p_items) = 0) THEN
    RAISE EXCEPTION 'السلة فارغة';
  END IF;

  SELECT id, name, phone INTO v_client FROM clients
   WHERE id = p_client_id AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;

  IF p_barber_id IS NOT NULL THEN
    SELECT id, name INTO v_vt_id, v_barber_name FROM barbers
     WHERE id = p_barber_id AND clinic_id = p_clinic_id;
  END IF;

  SELECT id INTO v_booking_id FROM bookings
   WHERE client_id = p_client_id AND clinic_id = p_clinic_id
     AND booking_date = v_date
     AND status IN ('pending', 'confirmed', 'checked_in', 'ongoing')
   ORDER BY booking_time ASC LIMIT 1;

  -- Pass 1: compute subtotal from catalog (server-side pricing)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(item, ord)
  LOOP
    SELECT * INTO v_service FROM services
     WHERE id = (v_line.item->>'service_id')::UUID
       AND clinic_id = p_clinic_id AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'خدمة غير موجودة أو غير مفعلة'; END IF;

    v_qty := GREATEST(COALESCE((v_line.item->>'quantity')::INT, 1), 1);
    v_price := COALESCE(v_service.price, 0);

    IF (v_line.item->>'variant_id') IS NOT NULL THEN
      SELECT * INTO v_variant FROM service_variants
       WHERE id = (v_line.item->>'variant_id')::UUID
         AND service_id = v_service.id AND clinic_id = p_clinic_id AND isActive = true;
      IF FOUND THEN v_price := COALESCE(v_variant.price, v_price); END IF;
    END IF;

    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'السلة فارغة'; END IF;

  IF p_discount_type = 'percentage' THEN
    v_discount_amount := ROUND((v_subtotal * LEAST(GREATEST(COALESCE(p_discount, 0), 0), 100)) / 100.0, 2);
  ELSE
    v_discount_amount := GREATEST(COALESCE(p_discount, 0), 0);
  END IF;
  v_discount_amount := LEAST(v_discount_amount, v_subtotal);
  v_total := v_subtotal - v_discount_amount;

  v_visit_number := COALESCE(
    (SELECT MAX(visit_number) FROM transactions WHERE clinic_id = p_clinic_id AND client_id = p_client_id),
    0
  ) + 1;

  v_invoice_no := public.get_next_invoice_no(v_date);

  INSERT INTO transactions (
    clinic_id, client_id, booking_id, client_name, client_phone,
    barber_id, barber_name, amount, discount, discount_type, total,
    payment_method, status, description, date, time, items, subtotal,
    visit_number, invoice_no, is_completed
  ) VALUES (
    p_clinic_id, p_client_id, v_booking_id, v_client.name, v_client.phone,
    v_vt_id, v_barber_name, v_subtotal, v_discount_amount, p_discount_type, v_total,
    p_payment_method, 'completed', p_notes, v_date, v_time::TIME, p_items, v_subtotal,
    v_visit_number, v_invoice_no, p_mark_done
  )
  RETURNING id INTO v_tx_id;

  -- Pass 2: invoice items + service purchases
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(item, ord)
  LOOP
    SELECT * INTO v_service FROM services
     WHERE id = (v_line.item->>'service_id')::UUID
       AND clinic_id = p_clinic_id AND active = true;
    CONTINUE WHEN NOT FOUND;

    v_qty := GREATEST(COALESCE((v_line.item->>'quantity')::INT, 1), 1);
    v_price := COALESCE(v_service.price, 0);
    v_name := COALESCE(v_service.nameAr, v_service.name, 'خدمة');
    v_type := v_service.service_type;
    v_unit := v_service.unit_label;
    v_pkg_qty := COALESCE(v_service.package_quantity, 0);
    v_bonus := COALESCE(v_service.bonus_quantity, 0);
    v_exp_val := v_service.expiry_value;
    v_exp_unit := v_service.expiry_unit;

    IF (v_line.item->>'variant_id') IS NOT NULL THEN
      SELECT * INTO v_variant FROM service_variants
       WHERE id = (v_line.item->>'variant_id')::UUID
         AND service_id = v_service.id AND clinic_id = p_clinic_id AND isActive = true;
       IF FOUND THEN
        v_price := COALESCE(v_variant.price, v_price);
        v_name := v_name || ' - ' || COALESCE(v_variant.name, '');
        v_type  := COALESCE(v_variant.service_type, v_type);
        v_unit  := COALESCE(v_variant.unit_label, v_unit);
        v_pkg_qty := COALESCE(v_variant.package_quantity, v_pkg_qty);
        v_bonus := COALESCE(v_variant.bonus_quantity, v_bonus);
        v_exp_val := COALESCE(v_variant.expiry_value, v_exp_val);
        v_exp_unit := COALESCE(v_variant.expiry_unit, v_exp_unit);
      END IF;
    END IF;

    v_line_total := ROUND((v_price * v_qty)::numeric, 2);

    v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
      'service_id', v_service.id,
      'name', v_name,
      'price', v_price,
      'quantity', v_qty,
      'unit_label', v_unit,
      'bonus_quantity', v_bonus,
      'service_type', v_type,
      'line_total', v_line_total,
      'variant_id', (v_line.item->>'variant_id')::UUID
    ));

    INSERT INTO invoice_items (
      clinic_id, transaction_id, service_id, service_name, service_type,
      unit_label, unit_price, quantity, bonus_quantity, line_total
    ) VALUES (
      p_clinic_id, v_tx_id, v_service.id, v_name, v_type,
      v_unit, v_price, v_qty, v_bonus, v_line_total
    );

    IF v_type = 'package' AND v_pkg_qty > 0 THEN
      v_expiry := NULL;
      IF v_exp_val IS NOT NULL AND v_exp_unit IS NOT NULL THEN
        v_expiry := v_date + (v_exp_val || ' ' || v_exp_unit)::INTERVAL;
      END IF;

      FOR i IN 1..v_qty LOOP
        INSERT INTO service_purchases (
          clinic_id, client_id, transaction_id, service_id, variant_id,
          service_name, unit_label, paid_quantity, bonus_quantity,
          total_quantity, remaining_quantity, unit_price, amount, expiry_date, status
        ) VALUES (
          p_clinic_id, p_client_id, v_tx_id, v_service.id,
          (v_line.item->>'variant_id')::UUID,
          v_name, v_unit, v_pkg_qty, v_bonus,
          v_pkg_qty + v_bonus, v_pkg_qty + v_bonus,
          v_price, v_price, v_expiry, 'active'
        );
      END LOOP;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
    INTO v_purchase_ids
    FROM service_purchases WHERE transaction_id = v_tx_id;

  v_is_completed := p_mark_done AND NOT EXISTS (
    SELECT 1 FROM service_purchases sp
     WHERE sp.transaction_id = v_tx_id
       AND sp.status = 'active'
       AND sp.remaining_quantity > 0
  );

  UPDATE transactions
     SET items = v_items_json,
         is_completed = v_is_completed,
         updated_at = NOW()
   WHERE id = v_tx_id;

  SELECT COUNT(*) INTO v_item_count FROM jsonb_array_elements(p_items);

  UPDATE clients
     SET total_visits = COALESCE(total_visits, 0) + 1,
         total_spent  = COALESCE(total_spent, 0) + v_total,
         last_visit   = v_date,
         updated_at   = NOW()
   WHERE id = p_client_id AND clinic_id = p_clinic_id;

  -- Write a visit ONLY when the service is actually performed now.
  -- A purchase-only sale (mark_done=false) writes NO visit; the future
  -- consumption/session usage will create its own visit.
  IF p_mark_done THEN
    INSERT INTO visit_logs (
      clinic_id, client_id, booking_id, barber_id, service_type,
      service_id, service_name, unit_label,
      "visitDate", visit_date, "visitTime", servicesCount, total_spent,
      start_time, notes, visit_type, duration, amount,
      visit_number, created_at, updated_at
    )
    SELECT
      p_clinic_id, p_client_id, v_booking_id, v_vt_id, v_type,
      v_service.id, v_name, v_unit,
      v_date, v_date, to_char(v_time, 'HH24:MI'),
      v_item_count, v_total,
      to_char(v_time, 'HH24:MI'), COALESCE(p_notes, 'خدمة منفذة'),
      'service', v_service.duration, v_total,
      v_visit_number, NOW(), NOW()
    FROM (SELECT 1) AS x
    LIMIT 1;
  END IF;

  IF p_mark_done AND v_booking_id IS NOT NULL THEN
    UPDATE bookings SET status = 'completed', updated_at = NOW()
     WHERE id = v_booking_id
       AND status IN ('pending', 'confirmed', 'checked_in', 'ongoing');
  END IF;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'invoice_no', v_invoice_no,
    'purchases', v_purchase_ids
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7) Grants
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.consume_service(UUID, UUID, UUID, INT, TEXT, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._consume_from_balance(UUID, UUID, UUID, INT, TEXT, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_service(UUID, UUID, UUID, INT, TEXT, UUID, UUID, UUID) TO authenticated;
GRANT SELECT ON public.service_consumptions TO authenticated;
GRANT SELECT ON public.balance_adjustments TO authenticated;
GRANT SELECT ON public.visit_logs TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');

SELECT '✅ Daily records / visits fix installed' AS status;

END;
