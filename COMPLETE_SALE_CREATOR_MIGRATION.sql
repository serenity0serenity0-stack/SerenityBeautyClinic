-- ============================================================================
-- COMPLETE_SALE CREATOR ATTRIBUTION MIGRATION (additive, non-destructive)
-- ----------------------------------------------------------------------------
-- Replaces complete_sale() to explicitly record created_by = auth.uid().
-- Preserves all existing business logic, parameters, defaults, return format,
-- and security behavior. Rejects the sale if auth.uid() is NULL.
-- The trigger trg_transactions_created_by remains as a fallback.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."complete_sale"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_items" "jsonb", "p_discount" numeric DEFAULT 0, "p_discount_type" character varying DEFAULT 'fixed'::character varying, "p_payment_method" character varying DEFAULT 'cash'::character varying, "p_barber_id" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text", "p_mark_done" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record a sale' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM admin_auth WHERE auth_user_id = auth.uid() AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: account does not belong to this clinic' USING ERRCODE = 'P0001';
  END IF;

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
    visit_number, invoice_no, is_completed, created_by
  ) VALUES (
    p_clinic_id, p_client_id, v_booking_id, v_client.name, v_client.phone,
    v_vt_id, v_barber_name, v_subtotal, v_discount_amount, p_discount_type, v_total,
    p_payment_method, 'completed', p_notes, v_date, v_time::TIME, p_items, v_subtotal,
    v_visit_number, v_invoice_no, p_mark_done, auth.uid()
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


ALTER FUNCTION "public"."complete_sale"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_items" "jsonb", "p_discount" numeric, "p_discount_type" character varying, "p_payment_method" character varying, "p_barber_id" "uuid", "p_notes" "text", "p_mark_done" boolean) OWNER TO "postgres";
