-- ============================================================================
-- COMPLETION_AND_DAILY_INVOICE_MIGRATION.sql
-- 1) transactions.is_completed : service-obligation completion (مكتملة/غير مكتملة)
--      - FALSE => الفاتورة سُجلت لكن الخدمة لم تُنفذ بعد (أو باقة جلسات لم تُستهلك)
--      - TRUE  => الخدمة تُنفذ الآن / تم اعتمادها / الجلسات انتهت
-- 2) Daily invoice number  YYYYMMDD + 0000 counter (يبدأ من 1 كل يوم)
-- 3) complete_sale(p_mark_done) writes the completion flag + daily invoice number
-- 4) mark_transaction_completed() RPC to approve from the client page
-- 5) _consume_from_balance auto-completes a package invoice when its last session is used
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) is_completed column (existing rows remain TRUE = past sales are complete)
-- ----------------------------------------------------------------------------
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT TRUE;

-- ----------------------------------------------------------------------------
-- 2) Daily invoice counter
--    invoice_no = (YYYYMMDD of the sale date) * 10000 + daily_seq (0001...9999)
--    استخدم هذا بدلا من تسلسل invoice_seq القديم
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_counters (
  invoice_date DATE PRIMARY KEY,
  last_no      INT NOT NULL
);

CREATE OR REPLACE FUNCTION public.get_next_invoice_no(p_date DATE)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_no INT;
BEGIN
  -- Atomic upsert: returns the post-insert/update last_no (safe under concurrency)
  INSERT INTO invoice_counters (invoice_date, last_no)
  VALUES (p_date, 1)
  ON CONFLICT (invoice_date)
  DO UPDATE SET last_no = invoice_counters.last_no + 1
  RETURNING last_no INTO v_no;

  RETURN (to_char(p_date, 'YYYYMMDD')::BIGINT * 10000) + v_no;
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_invoice_no(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_no(DATE) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3) complete_sale : now takes p_mark_done + writes daily invoice number + is_completed
--    Drop the legacy 8-arg signature first so it is fully replaced.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.complete_sale(
  p_client_id UUID,
  p_clinic_id UUID,
  p_items JSONB,
  p_discount DECIMAL DEFAULT 0,
  p_discount_type VARCHAR DEFAULT 'fixed',
  p_payment_method VARCHAR DEFAULT 'cash',
  p_barber_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_mark_done BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::date;
  v_time VARCHAR(5) := to_char(NOW() AT TIME ZONE 'Africa/Cairo', 'HH24:MI');
  v_client RECORD;
  v_booking_id UUID;
  v_barber_name VARCHAR;
  v_subtotal DECIMAL(10,2) := 0;
  v_discount_amount DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2) := 0;
  v_visit_number INT;
  v_invoice_no BIGINT;
  v_tx_id UUID;
  v_line RECORD;
  v_service RECORD;
  v_variant RECORD;
  v_qty INT;
  v_price DECIMAL(10,2);
  v_name VARCHAR;
  v_type VARCHAR(20);
  v_unit VARCHAR(20);
  v_pkg_qty INT := 0;
  v_bonus INT := 0;
  v_exp_val INT;
  v_exp_unit VARCHAR(10);
  v_line_total DECIMAL(10,2);
  v_expiry DATE;
  v_purchase_ids JSONB;
  v_item_count INT;
  v_items_json JSONB := '[]'::jsonb;
  v_is_completed BOOLEAN;
BEGIN
  IF p_client_id IS NULL THEN RAISE EXCEPTION 'يجب اختيار عميل أولاً'; END IF;
  IF p_clinic_id IS NULL THEN RAISE EXCEPTION 'Clinic ID مطلوب'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'السلة فارغة';
  END IF;

  PERFORM 1 FROM admin_auth WHERE auth_user_id = auth.uid() AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'غير مصرح لهذه العيادة'; END IF;

  SELECT id, name, phone INTO v_client FROM clients
   WHERE id = p_client_id AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;

  IF p_barber_id IS NOT NULL THEN
    SELECT name INTO v_barber_name FROM barbers
     WHERE id = p_barber_id AND clinic_id = p_clinic_id;
  END IF;

  -- Today's active booking for this client (auto-complete only when p_mark_done)
  SELECT id INTO v_booking_id FROM bookings
   WHERE clinic_id = p_clinic_id AND client_id = p_client_id
     AND booking_date = v_date
     AND status IN ('pending', 'confirmed', 'checked_in', 'ongoing')
   ORDER BY booking_time ASC
   LIMIT 1;

  -- ---- Pass 1: validate + compute subtotal from catalog (server-side pricing)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(item, ord)
  LOOP
    SELECT * INTO v_service FROM services
     WHERE id = (v_line.item->>'service_id')::UUID
       AND clinic_id = p_clinic_id AND active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'خدمة غير موجودة أو غير مفعلة';
    END IF;

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

  -- ---- Discount (server-side, clamped)
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

  -- Daily invoice number (YYYYMMDD + 0001...) instead of the legacy global sequence
  v_invoice_no := public.get_next_invoice_no(v_date);

  -- ---- Create transaction (invoice header)
  INSERT INTO transactions (
    clinic_id, client_id, booking_id, client_name, client_phone,
    barber_id, barber_name, amount, discount, discount_type, total,
    payment_method, status, description, date, time, items, subtotal,
    visit_number, invoice_no, is_completed
  ) VALUES (
    p_clinic_id, p_client_id, v_booking_id, v_client.name, v_client.phone,
    p_barber_id, v_barber_name, v_subtotal, v_discount_amount, p_discount_type, v_total,
    p_payment_method, 'completed', p_notes, v_date, v_time::TIME, p_items, v_subtotal,
    v_visit_number, v_invoice_no, p_mark_done
  )
  RETURNING id INTO v_tx_id;

  -- ---- Pass 2: invoice items + service purchases
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
      'line_total', v_line_total
    ));

    INSERT INTO invoice_items (
      clinic_id, transaction_id, service_id, service_name, service_type,
      unit_label, unit_price, quantity, bonus_quantity, line_total
    ) VALUES (
      p_clinic_id, v_tx_id, v_service.id, v_name, v_type,
      v_unit, v_price, v_qty, v_bonus, v_line_total
    );

    -- Create purchase rows for packages (one per bundle, each with its own expiry)
    IF v_type = 'package'
       AND v_pkg_qty > 0 THEN
      v_expiry := NULL;
      IF v_exp_val IS NOT NULL AND v_exp_unit IS NOT NULL THEN
        v_expiry := v_date + (v_exp_val || ' ' || v_exp_unit)::INTERVAL;
      END IF;

      FOR i IN 1..v_qty LOOP
        INSERT INTO service_purchases (
          clinic_id, client_id, transaction_id, service_id, service_name, unit_label,
          paid_quantity, bonus_quantity, total_quantity, remaining_quantity,
          unit_price, amount, expiry_date, status
        ) VALUES (
          p_clinic_id, p_client_id, v_tx_id, v_service.id, v_name, v_unit,
          v_pkg_qty, v_bonus,
          v_pkg_qty + v_bonus,
          v_pkg_qty + v_bonus,
          v_price, v_price, v_expiry, 'active'
        );
      END LOOP;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
    INTO v_purchase_ids
    FROM service_purchases WHERE transaction_id = v_tx_id;

  -- Completion: is_completed starts TRUE only when marked "done now" AND nothing
  -- remains in the client's balance for this invoice (e.g. a جلسات package is only
  -- مكتملة once its sessions are fully consumed).
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

  -- ---- Client counters
  UPDATE clients
     SET total_visits = COALESCE(total_visits, 0) + 1,
         total_spent  = COALESCE(total_spent, 0) + v_total,
         last_visit   = v_date,
         updated_at   = NOW()
   WHERE id = p_client_id AND clinic_id = p_clinic_id;

  -- ---- Visit log
  INSERT INTO visit_logs (clinic_id, client_id, "visitDate", visit_date,
                          "visitTime", "servicesCount", total_spent, notes)
  VALUES (p_clinic_id, p_client_id, v_date, v_date, v_time,
          v_item_count, v_total, COALESCE(p_notes, 'بيع عبر الكاشير'));

  -- ---- Auto-complete today's active booking ONLY when the service is being done now
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

REVOKE ALL ON FUNCTION public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT, BOOLEAN) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5) mark_transaction_completed : approve a pending invoice as مكتملة
--    Fails (raises) while the client still has remaining sessions/pulses on it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_transaction_completed(
  p_transaction_id UUID,
  p_clinic_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
BEGIN
  PERFORM 1 FROM admin_auth WHERE auth_user_id = auth.uid() AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'غير مصرح لهذه العيادة'; END IF;

  SELECT id, clinic_id, is_completed INTO v_tx
    FROM transactions
   WHERE id = p_transaction_id AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;

  IF v_tx.is_completed THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM service_purchases sp
     WHERE sp.transaction_id = p_transaction_id
       AND sp.status = 'active'
       AND sp.remaining_quantity > 0
  ) THEN
    RAISE EXCEPTION 'لا يمكن اعتماد هذه الفاتورة كمكتملة، ما زالت هناك جلسات متبقية في رصيد العميل';
  END IF;

  UPDATE transactions
     SET is_completed = TRUE,
         updated_at = NOW()
   WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_transaction_completed(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_transaction_completed(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4b) _consume_from_balance : auto-complete the invoice once its last session is used
--     (signature unchanged - CREATE OR REPLACE only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._consume_from_balance(
  p_client_id UUID,
  p_clinic_id UUID,
  p_service_id UUID,
  p_quantity INT,
  p_note TEXT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INT := p_quantity;
  v_today DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::date;
  v_purchase RECORD;
  v_used INT;
BEGIN
  IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'الكمية غير صالحة'; END IF;

  -- Mark purchases whose expiry has passed so they leave the available balance
  UPDATE service_purchases SET status = 'expired', updated_at = NOW()
   WHERE clinic_id = p_clinic_id AND client_id = p_client_id
     AND service_id = p_service_id AND status = 'active'
     AND remaining_quantity > 0
     AND expiry_date IS NOT NULL AND expiry_date < v_today;

  -- Consume earliest expiry first; purchases without expiry are consumed last.
  FOR v_purchase IN
    SELECT sp.id, sp.remaining_quantity, sp.expiry_date, sp.unit_label,
           sp.transaction_id,
           sp.service_name AS sp_name, COALESCE(s."nameAr", s.name, sp.service_name) AS svc_name
      FROM service_purchases sp
      LEFT JOIN services s ON s.id = sp.service_id
     WHERE sp.clinic_id = p_clinic_id AND sp.client_id = p_client_id
       AND sp.service_id = p_service_id
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
      clinic_id, client_id, purchase_id, service_id, service_name, unit_label,
      quantity, note, created_by
    ) VALUES (
      p_clinic_id, p_client_id, v_purchase.id, p_service_id,
      COALESCE(v_purchase.svc_name, 'خدمة'), v_purchase.unit_label,
      v_used, p_note, auth.uid()
    );

    -- When the invoice's LAST session/pulse is consumed, it becomes مكتملة automatically
    IF v_purchase.transaction_id IS NOT NULL THEN
      UPDATE transactions t
         SET is_completed = TRUE,
             updated_at = NOW()
       WHERE t.id = v_purchase.transaction_id
         AND t.is_completed = FALSE
         AND NOT EXISTS (
           SELECT 1 FROM service_purchases sp
            WHERE sp.transaction_id = t.id
              AND sp.status = 'active'
              AND sp.remaining_quantity > 0
         );
    END IF;

    v_qty := v_qty - v_used;
  END LOOP;

  IF v_qty > 0 THEN
    RAISE EXCEPTION 'الرصيد غير كافٍ. المتاح: % المطلوب: %', p_quantity - v_qty, p_quantity;
  END IF;

  RETURN p_quantity;
END;
$$;

-- ----------------------------------------------------------------------------
-- Reload the PostgREST schema cache so the new/changed RPC signatures
-- (complete_sale, mark_transaction_completed, ...) are available immediately.
-- ----------------------------------------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');

-- ----------------------------------------------------------------------------
-- Verify the new complete_sale signature exists (should print 9 arguments + p_mark_done)
-- ----------------------------------------------------------------------------
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS signature,
       p.proargnames
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'complete_sale';