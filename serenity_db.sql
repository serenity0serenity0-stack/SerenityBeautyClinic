


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."_consume_from_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text", "p_variant_id" "uuid" DEFAULT NULL::"uuid", "p_doctor_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."_consume_from_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text", "p_variant_id" "uuid", "p_doctor_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_is_staff_admin"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT a.clinic_id INTO v_clinic_id
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
    AND a.role = 'admin'
    AND COALESCE(a.active, true) = true;
  RETURN v_clinic_id;
END;
$$;


ALTER FUNCTION "public"."_is_staff_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_delta" integer, "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_service RECORD;
  v_used INT;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'القيمة يجب أن تكون أكبر أو أصغر من صفر';
  END IF;

  SELECT id, nameAr, name, unit_label INTO v_service FROM services
   WHERE id = p_service_id AND clinic_id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'خدمة غير موجودة'; END IF;

  IF p_delta > 0 THEN
    -- Grant = a purchase row with no invoice (price 0)
    INSERT INTO service_purchases (
      clinic_id, client_id, transaction_id, invoice_item_id, service_id, service_name,
      unit_label, paid_quantity, bonus_quantity, total_quantity, remaining_quantity,
      unit_price, amount, expiry_date, status
    ) VALUES (
      p_clinic_id, p_client_id, NULL, NULL, v_service.id,
      COALESCE(v_service.nameAr, v_service.name, 'خدمة'), v_service.unit_label,
      p_delta, 0, p_delta, p_delta, 0, 0, NULL, 'active'
    );
  ELSE
    v_used := public._consume_from_balance(
      p_client_id, p_clinic_id, p_service_id, ABS(p_delta), COALESCE(p_reason, 'تعديل رصيد')
    );
  END IF;

  INSERT INTO balance_adjustments (
    clinic_id, client_id, service_id, service_name, unit_label, delta, reason, created_by
  ) VALUES (
    p_clinic_id, p_client_id, v_service.id, COALESCE(v_service.nameAr, v_service.name, 'خدمة'),
    v_service.unit_label, p_delta, p_reason, auth.uid()
  );

  RETURN jsonb_build_object(
    'delta', p_delta,
    'applied', CASE WHEN p_delta > 0 THEN p_delta ELSE v_used END
  );
END;
$$;


ALTER FUNCTION "public"."adjust_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_delta" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bookings_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_booking_cairo  timestamp;
  v_wh_start       time;
  v_wh_end         time;
  v_vac_start      date;
  v_vac_end        date;
  v_days_off       jsonb;
  v_start          timestamptz;
  v_end            timestamptz;
  v_other          record;
  v_other_start    timestamptz;
  v_other_end      timestamptz;
BEGIN
  -- ---- derived columns ------------------------------------------------
  NEW.customer_phone  := COALESCE(NEW.customer_phone, NEW.client_phone);
  NEW.service_name    := COALESCE(NEW.service_name, NEW.service_type);
  NEW.booking_date    := NEW.booking_time::date;
  NEW.updated_at      := NOW();

  -- Only validate when schedule-relevant fields actually change.
  IF TG_OP = 'INSERT'
     OR NEW.booking_time IS DISTINCT FROM OLD.booking_time
     OR NEW.barber_id     IS DISTINCT FROM OLD.barber_id
     OR NEW.duration      IS DISTINCT FROM OLD.duration THEN

    -- booking_time is a naive timestamp in clinic (Cairo) wall time.
    v_booking_cairo := NEW.booking_time;

    -- ---- past-time guard (clinic local time) ---------------------------
    IF v_booking_cairo < (NOW() AT TIME ZONE 'Africa/Cairo') - interval '5 minutes' THEN
      RAISE EXCEPTION 'Cannot book an appointment in the past (booking_time is in the past)'
        USING ERRCODE = 'P0001';
    END IF;

    -- ---- doctor availability guard -------------------------------------
    IF NEW.barber_id IS NOT NULL THEN
      SELECT working_hours_start, working_hours_end, vacation_start, vacation_end, days_off
        INTO v_wh_start, v_wh_end, v_vac_start, v_vac_end, v_days_off
        FROM barbers
       WHERE id = NEW.barber_id;

      IF v_wh_start IS NOT NULL AND v_wh_end IS NOT NULL AND v_wh_end > v_wh_start THEN
        IF v_booking_cairo::time < v_wh_start
           OR v_booking_cairo::time + (COALESCE(NEW.duration, 30) * interval '1 minute') > v_wh_end THEN
          RAISE EXCEPTION 'This booking is outside the doctor working hours'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;

      IF v_vac_start IS NOT NULL AND v_booking_cairo::date BETWEEN v_vac_start AND v_vac_end THEN
        RAISE EXCEPTION 'This doctor is on vacation'
          USING ERRCODE = 'P0001';
      END IF;

      IF jsonb_typeof(COALESCE(v_days_off, '[]'::jsonb)) = 'array'
         AND EXISTS (
           SELECT 1
             FROM jsonb_array_elements_text(COALESCE(v_days_off, '[]'::jsonb)) AS dow
            WHERE dow ~ '^[0-6]$' AND dow::int = EXTRACT(DOW FROM v_booking_cairo::date)
         ) THEN
        RAISE EXCEPTION 'This doctor is off duty on the selected day'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- ---- per-doctor overlap guard (double-booking prevention) ----------
    IF NEW.barber_id IS NOT NULL THEN
      v_start := NEW.booking_time;
      v_end   := NEW.booking_time + COALESCE(NEW.duration, 30) * interval '1 minute';

      FOR v_other IN
        SELECT b.booking_time, b.duration
          FROM bookings b
         WHERE b.barber_id = NEW.barber_id
           AND b.id <> NEW.id
           AND b.status <> 'cancelled'
      LOOP
        v_other_start := v_other.booking_time;
        v_other_end   := v_other.booking_time + COALESCE(v_other.duration, 30) * interval '1 minute';

        IF v_start < v_other_end AND v_end > v_other_start THEN
          RAISE EXCEPTION 'This time slot is already booked for this doctor'
            USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."bookings_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_session_valid"() RETURNS TABLE("is_active" boolean, "security_version" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(a.active, true), a.security_version
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."check_session_valid"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."complete_sale"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_items" "jsonb", "p_discount" numeric, "p_discount_type" character varying, "p_payment_method" character varying, "p_barber_id" "uuid", "p_notes" "text", "p_mark_done" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_service"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text" DEFAULT NULL::"text", "p_variant_id" "uuid" DEFAULT NULL::"uuid", "p_doctor_id" "uuid" DEFAULT NULL::"uuid", "p_employee_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."consume_service"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text", "p_variant_id" "uuid", "p_doctor_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_staff_user"("p_email" "text", "p_password" "text", "p_role" "text" DEFAULT 'cashier'::"text", "p_name" "text" DEFAULT NULL::"text", "p_permissions" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_user_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF p_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Prevent duplicate email
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) OR
     EXISTS (SELECT 1 FROM public.admin_auth WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  -- Create auth user (confirmed immediately)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    email_change, reauthentication_token, phone_change_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '', '', '', '',
    '', '', '',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}'::jsonb,
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create identity row (email is GENERATED from identity_data, do NOT insert it)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- Create admin_auth record
  INSERT INTO public.admin_auth (
    email, auth_user_id, clinic_id, role, active, name, permissions, password
  )
  VALUES (
    v_email, v_user_id, v_clinic_id, p_role, true, p_name,
    CASE WHEN p_role = 'admin' THEN '["all"]'::jsonb ELSE COALESCE(p_permissions, '[]'::jsonb) END,
    p_password
  );

  RETURN jsonb_build_object('id', v_user_id, 'email', v_email);
END;
$$;


ALTER FUNCTION "public"."create_staff_user"("p_email" "text", "p_password" "text", "p_role" "text", "p_name" "text", "p_permissions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_daily_record"("p_type" "text", "p_id" "uuid", "p_clinic_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_client_id UUID;
  v_total NUMERIC;
  v_partial BOOLEAN;
  v_visit RECORD;
  v_purchase RECORD;
  v_cons RECORD;
BEGIN
  IF p_type = 'transaction' THEN
    SELECT client_id, total INTO v_client_id, v_total
      FROM transactions
     WHERE id = p_id AND clinic_id = p_clinic_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;

    -- Guard: refuse to delete a sale whose balance was partially used.
    SELECT EXISTS (
      SELECT 1 FROM service_purchases
       WHERE transaction_id = p_id AND remaining_quantity < total_quantity
    ) INTO v_partial;
    IF v_partial THEN
      RAISE EXCEPTION 'لا يمكن حذف هذه المبيعة لأن جزءاً من رصيدها تم صرفه بالفعل';
    END IF;

    DELETE FROM service_consumptions
      WHERE purchase_id IN (SELECT id FROM service_purchases WHERE transaction_id = p_id);
    DELETE FROM service_purchases WHERE transaction_id = p_id;
    DELETE FROM invoice_items WHERE transaction_id = p_id;
    DELETE FROM transactions WHERE id = p_id;

    UPDATE clients SET
      total_spent   = GREATEST(COALESCE(total_spent, 0) - COALESCE(v_total, 0), 0),
      total_visits  = GREATEST(COALESCE(total_visits, 0) - 1, 0),
      updated_at    = NOW()
     WHERE id = v_client_id AND clinic_id = p_clinic_id;

    RETURN 'تم حذف المبيعة وعكس الرصيد';

  ELSIF p_type = 'consumption' THEN
    SELECT * INTO v_visit
      FROM visit_logs
     WHERE id = p_id AND clinic_id = p_clinic_id AND visit_type = 'consumption';
    IF NOT FOUND THEN RAISE EXCEPTION 'هذا السجل ليس صرف رصيد'; END IF;

    v_client_id := v_visit.client_id;

    -- 1) Give the quantity back to the purchases that were consumed by this visit.
    FOR v_cons IN
      SELECT id, purchase_id, quantity FROM service_consumptions
       WHERE clinic_id = p_clinic_id
         AND client_id = v_client_id
         AND (visit_id = v_visit.id
              OR (visit_id IS NULL
                  AND ABS(EXTRACT(EPOCH FROM (created_at - v_visit.created_at))) < 120))
    LOOP
      UPDATE service_purchases
         SET remaining_quantity = remaining_quantity + v_cons.quantity,
             status = 'active',
             updated_at = NOW()
       WHERE id = v_cons.purchase_id;
      DELETE FROM service_consumptions WHERE id = v_cons.id;
    END LOOP;

    -- 2) Remove the visit record.
    DELETE FROM visit_logs WHERE id = p_id;

    -- 3) Reflect on the client.
    UPDATE clients SET
      total_visits = GREATEST(COALESCE(total_visits, 0) - 1, 0),
      updated_at   = NOW()
     WHERE id = v_client_id AND clinic_id = p_clinic_id;

    RETURN 'تم حذف الصرف وإعادة الرصيد';

  ELSE
    RAISE EXCEPTION 'نوع غير مدعوم';
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_daily_record"("p_type" "text", "p_id" "uuid", "p_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_staff_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_clinic_id uuid;
  v_target_clinic uuid;
BEGIN
  SELECT a.clinic_id INTO v_clinic_id
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
    AND a.role = 'admin'
    AND COALESCE(a.active, true) = true
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT a.clinic_id INTO v_target_clinic
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = p_user_id::text
  LIMIT 1;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Audit FIRST: once admin_auth row is gone we lose the actor context.
  BEGIN
    INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      p_user_id,
      'user_deleted',
      jsonb_build_object('tokens_revoked', true)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log skipped: %', SQLERRM;
  END;

  -- Revoke every session of the deleted user (best effort: never blocks delete)
  BEGIN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_tokens cleanup skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'DELETE FROM auth.identities WHERE user_id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'identities cleanup skipped: %', SQLERRM;
  END;

  -- App-level record
  DELETE FROM public.admin_auth WHERE auth_user_id::text = p_user_id::text;

  -- Auth account (best effort: if this fails the account is deactivated in the
  -- app and simply cannot sign in, and the warning tells us what happened)
  BEGIN
    EXECUTE 'DELETE FROM auth.users WHERE id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auth.users cleanup skipped: %', SQLERRM;
  END;
END;
$_$;


ALTER FUNCTION "public"."delete_staff_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clinic_id_for_user"("user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT a.clinic_id INTO v_clinic_id
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = user_id::text
    AND COALESCE(a.active, true) = true
  LIMIT 1;

  RETURN v_clinic_id;
END;
$$;


ALTER FUNCTION "public"."get_clinic_id_for_user"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_auth_info"() RETURNS TABLE("role" "text", "name" "text", "permissions" "jsonb", "clinic_id" "uuid", "active" boolean, "email" "text", "security_version" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.role::text,
    a.name,
    a.permissions,
    a.clinic_id,
    COALESCE(a.active, true),
    a.email::text,
    COALESCE(a.security_version, 1)::int
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_my_auth_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_invoice_no"("p_date" "date") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_next_invoice_no"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_users"() RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text", "active" boolean, "permissions" "jsonb", "password" "text", "auth_user_id" "uuid", "created_at" timestamp without time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can view users';
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.email::text, a.name, a.role::text, COALESCE(a.active, true),
    a.permissions, a.password, a.auth_user_id::uuid, a.created_at
  FROM public.admin_auth a
  WHERE a.clinic_id = v_clinic_id
  ORDER BY a.role = 'admin' DESC, a.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_staff_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_transaction_completed"("p_transaction_id" "uuid", "p_clinic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."mark_transaction_completed"("p_transaction_id" "uuid", "p_clinic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_staff_password"("p_user_id" "uuid", "p_new_password" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_target_clinic uuid;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT a.clinic_id INTO v_target_clinic
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = p_user_id::text
  LIMIT 1;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id::text = p_user_id::text;

  UPDATE public.admin_auth
  SET password = p_new_password,
      security_version = COALESCE(security_version, 1) + 1,
      updated_at = now()
  WHERE auth_user_id::text = p_user_id::text;

  BEGIN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_tokens cleanup skipped: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      p_user_id,
      'password_reset',
      jsonb_build_object('tokens_revoked', true)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log skipped: %', SQLERRM;
  END;
END;
$_$;


ALTER FUNCTION "public"."reset_staff_password"("p_user_id" "uuid", "p_new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_clients"("p_clinic_id" "uuid", "p_query" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_q TEXT;
  v_q_ascii TEXT;
  v_result JSONB;
BEGIN
  IF p_query IS NULL THEN v_q := ''; ELSE v_q := trim(p_query); END IF;

  -- Ambiguity guard: when the query is only digits, treat it as a phone/مريض
  -- (MRN may come later). Convert Arabic-Indic digits ٠١٢٣... to 0-9.
  v_q_ascii := translation(v_q, '٠١٢٣٤٥٦٧٨٩', '0123456789');

  IF v_q = '' THEN
    SELECT jsonb_agg(j)::jsonb INTO v_result FROM (
      SELECT to_jsonb(c) AS j
        FROM clients c
       WHERE c.clinic_id = p_clinic_id
       ORDER BY c.created_at DESC
       LIMIT 20
    ) t;
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;

  SELECT jsonb_agg(j)::jsonb INTO v_result FROM (
    SELECT to_jsonb(c) AS j
      FROM clients c
     WHERE c.clinic_id = p_clinic_id
       AND (
         lower(c.name) ILIKE '%' || lower(v_q) || '%'
         OR translate(translate(regexp_replace(c.phone, '\D', '', 'g'), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '.', '') LIKE '%' || v_q_ascii || '%'
         OR position(v_q_ascii in translate(translate(regexp_replace(c.phone, '\D', '', 'g'), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '.', '')) > 0
       )
     ORDER BY
       CASE
         WHEN lower(c.name) LIKE lower(v_q) || '%' THEN 0
         WHEN position(v_q_ascii in translate(translate(regexp_replace(c.phone, '\D', '', 'g'), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '.', '')) = 1 THEN 1
         ELSE 2
       END,
       c.created_at DESC
     LIMIT 20
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."search_clients"("p_clinic_id" "uuid", "p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_user"("p_user_id" "uuid", "p_role" "text" DEFAULT NULL::"text", "p_name" "text" DEFAULT NULL::"text", "p_permissions" "jsonb" DEFAULT NULL::"jsonb", "p_active" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_target_clinic uuid;
  v_old_active boolean;
  v_new_active boolean;
  v_bumped boolean := false;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;

  SELECT a.clinic_id, COALESCE(a.active, true) INTO v_target_clinic, v_old_active
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = p_user_id::text
  LIMIT 1;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_user_id = auth.uid() AND COALESCE(p_active, true) = false THEN
    RAISE EXCEPTION 'You cannot disable your own account';
  END IF;

  v_new_active := COALESCE(p_active, v_old_active);

  -- Bump the version ONLY when the account is enabled/disabled, so editing a
  -- name or permissions never kicks the user out of their session.
  IF p_active IS NOT NULL AND p_active <> v_old_active THEN
    v_bumped := true;
  END IF;

  UPDATE public.admin_auth SET
    role = COALESCE(p_role, role),
    name = COALESCE(p_name, name),
    permissions = CASE
      WHEN p_role = 'admin' THEN '["all"]'::jsonb
      ELSE COALESCE(p_permissions, permissions)
    END,
    active = v_new_active,
    security_version = CASE
      WHEN v_bumped THEN COALESCE(security_version, 1) + 1
      ELSE COALESCE(security_version, 1)
    END,
    updated_at = now()
  WHERE auth_user_id::text = p_user_id::text;

  BEGIN
    INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      p_user_id,
      CASE WHEN v_new_active THEN 'user_enabled' ELSE 'user_disabled' END,
      jsonb_build_object('old_active', v_old_active, 'new_active', v_new_active, 'version_bumped', v_bumped)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log skipped: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "public"."update_staff_user"("p_user_id" "uuid", "p_role" "text", "p_name" "text", "p_permissions" "jsonb", "p_active" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_auth" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "role" character varying(50) DEFAULT 'admin'::character varying,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "name" "text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "password" "text",
    "security_version" integer DEFAULT 1
);


ALTER TABLE "public"."admin_auth" OWNER TO "postgres";


COMMENT ON COLUMN "public"."admin_auth"."password" IS 'Plain-text password copy so the admin can view/reset it. Only visible through the admin-only get_staff_users() function.';



CREATE TABLE IF NOT EXISTS "public"."balance_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" character varying(255) NOT NULL,
    "unit_label" character varying(20),
    "delta" integer NOT NULL,
    "reason" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" "uuid",
    "variant_id" "uuid"
);

ALTER TABLE ONLY "public"."balance_adjustments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."balance_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(20),
    "email" character varying(255),
    "specialization" "text",
    "bio" "text",
    "image_url" character varying(500),
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "working_hours_start" time without time zone DEFAULT '09:00:00'::time without time zone,
    "working_hours_end" time without time zone DEFAULT '21:00:00'::time without time zone,
    "days_off" "jsonb" DEFAULT '[]'::"jsonb",
    "vacation_start" "date",
    "vacation_end" "date"
);


ALTER TABLE "public"."barbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_integrity_backup" (
    "id" "uuid" NOT NULL,
    "old_status" character varying(50),
    "reason" character varying(255),
    "changed_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."booking_integrity_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "client_name" character varying(255) NOT NULL,
    "client_phone" character varying(20) NOT NULL,
    "barber_id" "uuid",
    "barber_name" character varying(255),
    "service_type" character varying(255),
    "booking_date" "date",
    "booking_time" timestamp without time zone NOT NULL,
    "duration" integer DEFAULT 30,
    "queue_number" integer,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "customer_phone" character varying(20),
    "service_name" character varying(255),
    CONSTRAINT "bookings_duration_check" CHECK ((("duration" IS NULL) OR ("duration" >= 5))),
    CONSTRAINT "bookings_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'checked_in'::character varying, 'ongoing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "invoice_item_id" "uuid",
    "service_id" "uuid",
    "service_name" character varying(255) NOT NULL,
    "unit_label" character varying(20),
    "paid_quantity" integer NOT NULL,
    "bonus_quantity" integer DEFAULT 0 NOT NULL,
    "total_quantity" integer NOT NULL,
    "remaining_quantity" integer NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "expiry_date" "date",
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "variant_id" "uuid"
);

ALTER TABLE ONLY "public"."service_purchases" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_purchases" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."client_balance_summary" AS
 SELECT "clinic_id",
    "client_id",
    "service_id",
    "variant_id",
    ("array_agg"("service_name" ORDER BY ("length"(("service_name")::"text")) DESC))[1] AS "service_name",
    "min"(("unit_label")::"text") AS "unit_label",
    "sum"(
        CASE
            WHEN (("status")::"text" <> 'voided'::"text") THEN "paid_quantity"
            ELSE 0
        END) AS "purchased",
    "sum"(
        CASE
            WHEN (("status")::"text" <> 'voided'::"text") THEN "bonus_quantity"
            ELSE 0
        END) AS "bonus",
    "sum"(
        CASE
            WHEN ((("status")::"text" = 'active'::"text") AND ("remaining_quantity" > 0)) THEN "remaining_quantity"
            ELSE 0
        END) AS "remaining",
    "count"(*) FILTER (WHERE ((("status")::"text" = 'active'::"text") AND ("remaining_quantity" > 0))) AS "active_purchases",
    "min"(
        CASE
            WHEN ((("status")::"text" = 'active'::"text") AND ("remaining_quantity" > 0)) THEN "expiry_date"
            ELSE NULL::"date"
        END) AS "earliest_expiry",
    "count"(*) FILTER (WHERE (("status")::"text" <> 'voided'::"text")) AS "total_purchases"
   FROM "public"."service_purchases"
  GROUP BY "clinic_id", "client_id", "service_id", "variant_id";


ALTER VIEW "public"."client_balance_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(20) NOT NULL,
    "email" character varying(255),
    "birthday" "date",
    "notes" "text",
    "total_visits" integer DEFAULT 0,
    "total_spent" numeric(10,2) DEFAULT 0,
    "is_vip" boolean DEFAULT false,
    "last_visit" "date",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) DEFAULT 'Serenity Beauty Clinic'::character varying NOT NULL,
    "email" character varying(255),
    "phone" character varying(20),
    "city" character varying(100),
    "description" "text",
    "logo_url" character varying(500),
    "website" character varying(255),
    "admin_email" character varying(255),
    "admin_name" character varying(255),
    "primary_color" character varying(7) DEFAULT '#E91E63'::character varying,
    "secondary_color" character varying(7) DEFAULT '#C2185B'::character varying,
    "accent_color" character varying(7) DEFAULT '#F06292'::character varying,
    "timezone" character varying(50) DEFAULT 'Africa/Cairo'::character varying,
    "currency" character varying(3) DEFAULT 'EGP'::character varying,
    "language" character varying(2) DEFAULT 'ar'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_by" "uuid",
    "created_by_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "category" character varying(100) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "date" "date" NOT NULL,
    "note" "text",
    "receipt_url" character varying(500),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_counters" (
    "invoice_date" "date" NOT NULL,
    "last_no" integer NOT NULL
);


ALTER TABLE "public"."invoice_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" character varying(255) NOT NULL,
    "service_type" character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    "unit_label" character varying(20),
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "bonus_quantity" integer DEFAULT 0 NOT NULL,
    "line_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."invoice_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_seq"
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "portal_enabled" boolean DEFAULT false,
    "portal_title" character varying(255) DEFAULT 'Serenity Beauty Clinic'::character varying,
    "portal_description" "text",
    "allow_booking" boolean DEFAULT true,
    "allow_profile_edit" boolean DEFAULT true,
    "auto_logout_minutes" integer DEFAULT 60,
    "branding_logo_url" character varying(500),
    "branding_primary_color" character varying(7) DEFAULT '#E91E63'::character varying,
    "branding_secondary_color" character varying(7) DEFAULT '#C2185B'::character varying,
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "email" character varying(255) NOT NULL,
    "phone" character varying(20) NOT NULL,
    "name" character varying(255),
    "password_hash" character varying(255),
    "session_token" character varying(500),
    "session_expires_at" timestamp without time zone,
    "last_login" timestamp without time zone,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_consumptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" character varying(255) NOT NULL,
    "unit_label" character varying(20),
    "quantity" integer NOT NULL,
    "note" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" "uuid",
    "variant_id" "uuid",
    "visit_id" "uuid"
);

ALTER TABLE ONLY "public"."service_consumptions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_consumptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration" integer DEFAULT 30,
    "isactive" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "isActive" boolean DEFAULT true,
    "service_type" character varying(20),
    "unit_label" character varying(20),
    "package_quantity" integer,
    "bonus_quantity" integer DEFAULT 0 NOT NULL,
    "expiry_value" integer,
    "expiry_unit" character varying(10)
);


ALTER TABLE "public"."service_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "namear" character varying(255),
    "nameen" character varying(255),
    "name" character varying(255),
    "price" numeric(10,2) NOT NULL,
    "duration" integer DEFAULT 30,
    "category" character varying(100),
    "description" "text",
    "active" boolean DEFAULT true,
    "image_url" character varying(500),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "nameAr" character varying(255),
    "nameEn" character varying(255),
    "service_type" character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    "unit_label" character varying(20),
    "package_quantity" integer,
    "bonus_quantity" integer DEFAULT 0 NOT NULL,
    "expiry_value" integer,
    "expiry_unit" character varying(10),
    CONSTRAINT "services_expiry_unit_check" CHECK ((("expiry_unit" IS NULL) OR (("expiry_unit")::"text" = ANY ((ARRAY['days'::character varying, 'weeks'::character varying, 'months'::character varying])::"text"[])))),
    CONSTRAINT "services_service_type_check" CHECK ((("service_type")::"text" = ANY ((ARRAY['regular'::character varying, 'package'::character varying])::"text"[])))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "key" character varying(255) NOT NULL,
    "value" "jsonb",
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "plan" character varying(50) DEFAULT 'professional'::character varying NOT NULL,
    "status" character varying(50) DEFAULT 'active'::character varying NOT NULL,
    "started_at" timestamp without time zone DEFAULT "now"(),
    "expires_at" timestamp without time zone NOT NULL,
    "payment_method" character varying(50),
    "auto_renew" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "booking_id" "uuid",
    "client_name" character varying(255),
    "client_phone" character varying(20),
    "barber_id" "uuid",
    "barber_name" character varying(255),
    "amount" numeric(10,2),
    "discount" numeric(10,2) DEFAULT 0,
    "discount_type" character varying(50),
    "total" numeric(10,2) NOT NULL,
    "payment_method" character varying(50) DEFAULT 'cash'::character varying,
    "status" character varying(50) DEFAULT 'completed'::character varying,
    "description" "text",
    "date" "date" NOT NULL,
    "time" time without time zone,
    "items" "jsonb",
    "subtotal" numeric(10,2),
    "visit_number" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "invoice_no" bigint,
    "is_completed" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "booking_id" "uuid",
    "barber_id" "uuid",
    "service_type" character varying(255),
    "duration" integer,
    "amount" numeric(10,2),
    "notes" "text",
    "visit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "visit_number" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "servicesCount" integer DEFAULT 0,
    "total_spent" numeric(10,2) DEFAULT 0,
    "visitTime" character varying(5) DEFAULT '00:00'::character varying,
    "visitDate" "date" DEFAULT CURRENT_DATE NOT NULL,
    "service_id" "uuid",
    "variant_id" "uuid",
    "service_name" character varying(255),
    "unit_label" character varying(20),
    "purchase_id" "uuid",
    "quantity" integer DEFAULT 0,
    "balance_before" integer DEFAULT 0,
    "balance_after" integer DEFAULT 0,
    "doctor_id" "uuid",
    "doctor_name" character varying(255),
    "employee_id" "uuid",
    "employee_name" character varying(255),
    "start_time" "text",
    "end_time" "text",
    "visit_type" character varying(20) DEFAULT 'service'::character varying,
    "client_name" character varying(255),
    "servicescount" integer DEFAULT 0
);


ALTER TABLE "public"."visit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waiting_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clinic_id" "uuid",
    "client_id" "uuid",
    "client_name" character varying(255) NOT NULL,
    "client_phone" character varying(20) NOT NULL,
    "barber_id" "uuid",
    "barber_name" character varying(255),
    "service_type" character varying(255),
    "duration" integer DEFAULT 30,
    "status" character varying(50) DEFAULT 'waiting'::character varying,
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "waiting_list_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['waiting'::character varying, 'notified'::character varying, 'booked'::character varying, 'removed'::character varying])::"text"[])))
);


ALTER TABLE "public"."waiting_list" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_auth"
    ADD CONSTRAINT "admin_auth_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."admin_auth"
    ADD CONSTRAINT "admin_auth_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."admin_auth"
    ADD CONSTRAINT "admin_auth_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balance_adjustments"
    ADD CONSTRAINT "balance_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbers"
    ADD CONSTRAINT "barbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_integrity_backup"
    ADD CONSTRAINT "booking_integrity_backup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic"
    ADD CONSTRAINT "clinic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_counters"
    ADD CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("invoice_date");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_settings"
    ADD CONSTRAINT "portal_settings_clinic_id_key" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."portal_settings"
    ADD CONSTRAINT "portal_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_users"
    ADD CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_consumptions"
    ADD CONSTRAINT "service_consumptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_purchases"
    ADD CONSTRAINT "service_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_variants"
    ADD CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_clinic_id_key" UNIQUE ("clinic_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visit_logs"
    ADD CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waiting_list"
    ADD CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "bookings_no_double_booking_unique" ON "public"."bookings" USING "btree" ("barber_id", "booking_time") WHERE (("barber_id" IS NOT NULL) AND (("status")::"text" <> 'cancelled'::"text"));



CREATE INDEX "idx_balance_adjustments_client_id" ON "public"."balance_adjustments" USING "btree" ("client_id");



CREATE INDEX "idx_balance_adjustments_clinic_id" ON "public"."balance_adjustments" USING "btree" ("clinic_id");



CREATE INDEX "idx_balance_adjustments_variant_id" ON "public"."balance_adjustments" USING "btree" ("variant_id");



CREATE INDEX "idx_barbers_clinic_id" ON "public"."barbers" USING "btree" ("clinic_id");



CREATE INDEX "idx_bookings_clinic_barber_time" ON "public"."bookings" USING "btree" ("clinic_id", "barber_id", "booking_time");



CREATE INDEX "idx_bookings_clinic_id" ON "public"."bookings" USING "btree" ("clinic_id");



CREATE INDEX "idx_bookings_clinic_phone" ON "public"."bookings" USING "btree" ("clinic_id", "client_phone");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_clients_clinic_id" ON "public"."clients" USING "btree" ("clinic_id");



CREATE INDEX "idx_customer_notes_clinic_id" ON "public"."customer_notes" USING "btree" ("clinic_id");



CREATE INDEX "idx_customer_notes_customer_id" ON "public"."customer_notes" USING "btree" ("customer_id");



CREATE INDEX "idx_expenses_clinic_id" ON "public"."expenses" USING "btree" ("clinic_id");



CREATE INDEX "idx_invoice_items_clinic_id" ON "public"."invoice_items" USING "btree" ("clinic_id");



CREATE INDEX "idx_invoice_items_transaction_id" ON "public"."invoice_items" USING "btree" ("transaction_id");



CREATE INDEX "idx_portal_users_clinic_id" ON "public"."portal_users" USING "btree" ("clinic_id");



CREATE INDEX "idx_service_consumptions_client_id" ON "public"."service_consumptions" USING "btree" ("client_id");



CREATE INDEX "idx_service_consumptions_clinic_id" ON "public"."service_consumptions" USING "btree" ("clinic_id");



CREATE INDEX "idx_service_consumptions_purchase_id" ON "public"."service_consumptions" USING "btree" ("purchase_id");



CREATE INDEX "idx_service_consumptions_variant_id" ON "public"."service_consumptions" USING "btree" ("variant_id");



CREATE INDEX "idx_service_consumptions_visit_id" ON "public"."service_consumptions" USING "btree" ("visit_id");



CREATE INDEX "idx_service_purchases_balance" ON "public"."service_purchases" USING "btree" ("client_id", "service_id", "status", "expiry_date");



CREATE INDEX "idx_service_purchases_client_id" ON "public"."service_purchases" USING "btree" ("client_id");



CREATE INDEX "idx_service_purchases_clinic_id" ON "public"."service_purchases" USING "btree" ("clinic_id");



CREATE INDEX "idx_service_purchases_service_id" ON "public"."service_purchases" USING "btree" ("service_id");



CREATE INDEX "idx_service_purchases_variant_id" ON "public"."service_purchases" USING "btree" ("variant_id");



CREATE INDEX "idx_service_variants_clinic_id" ON "public"."service_variants" USING "btree" ("clinic_id");



CREATE INDEX "idx_services_clinic_id" ON "public"."services" USING "btree" ("clinic_id");



CREATE INDEX "idx_settings_clinic_id" ON "public"."settings" USING "btree" ("clinic_id");



CREATE INDEX "idx_subscriptions_clinic_id" ON "public"."subscriptions" USING "btree" ("clinic_id");



CREATE INDEX "idx_transactions_clinic_id" ON "public"."transactions" USING "btree" ("clinic_id");



CREATE INDEX "idx_transactions_date" ON "public"."transactions" USING "btree" ("date");



CREATE INDEX "idx_transactions_invoice_no" ON "public"."transactions" USING "btree" ("invoice_no");



CREATE INDEX "idx_visit_logs_clinic_id" ON "public"."visit_logs" USING "btree" ("clinic_id");



CREATE INDEX "idx_visit_logs_purchase_id" ON "public"."visit_logs" USING "btree" ("purchase_id");



CREATE INDEX "idx_visit_logs_service_id" ON "public"."visit_logs" USING "btree" ("service_id");



CREATE INDEX "idx_visit_logs_visit_type" ON "public"."visit_logs" USING "btree" ("visit_type");



CREATE INDEX "idx_waiting_list_barber_id" ON "public"."waiting_list" USING "btree" ("barber_id");



CREATE INDEX "idx_waiting_list_clinic_id" ON "public"."waiting_list" USING "btree" ("clinic_id");



CREATE INDEX "idx_waiting_list_status" ON "public"."waiting_list" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "trg_bookings_before_write" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."bookings_before_write"();



CREATE OR REPLACE TRIGGER "trigger_customer_notes_updated_at" BEFORE UPDATE ON "public"."customer_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_customer_notes_updated_at"();



ALTER TABLE ONLY "public"."admin_auth"
    ADD CONSTRAINT "admin_auth_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balance_adjustments"
    ADD CONSTRAINT "balance_adjustments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balance_adjustments"
    ADD CONSTRAINT "balance_adjustments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balance_adjustments"
    ADD CONSTRAINT "balance_adjustments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."barbers"
    ADD CONSTRAINT "barbers_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_settings"
    ADD CONSTRAINT "portal_settings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_users"
    ADD CONSTRAINT "portal_users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_users"
    ADD CONSTRAINT "portal_users_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_consumptions"
    ADD CONSTRAINT "service_consumptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_consumptions"
    ADD CONSTRAINT "service_consumptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_consumptions"
    ADD CONSTRAINT "service_consumptions_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."service_purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_consumptions"
    ADD CONSTRAINT "service_consumptions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_purchases"
    ADD CONSTRAINT "service_purchases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_purchases"
    ADD CONSTRAINT "service_purchases_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_purchases"
    ADD CONSTRAINT "service_purchases_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_purchases"
    ADD CONSTRAINT "service_purchases_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_purchases"
    ADD CONSTRAINT "service_purchases_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_variants"
    ADD CONSTRAINT "service_variants_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_variants"
    ADD CONSTRAINT "service_variants_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_logs"
    ADD CONSTRAINT "visit_logs_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visit_logs"
    ADD CONSTRAINT "visit_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visit_logs"
    ADD CONSTRAINT "visit_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visit_logs"
    ADD CONSTRAINT "visit_logs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waiting_list"
    ADD CONSTRAINT "waiting_list_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waiting_list"
    ADD CONSTRAINT "waiting_list_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waiting_list"
    ADD CONSTRAINT "waiting_list_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinic"("id") ON DELETE CASCADE;



CREATE POLICY "Staff can create customer notes for their clinic" ON "public"."customer_notes" FOR INSERT TO "authenticated" WITH CHECK (("clinic_id" IN ( SELECT "admin_auth"."clinic_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can delete customer notes for their clinic" ON "public"."customer_notes" FOR DELETE TO "authenticated" USING (("clinic_id" IN ( SELECT "admin_auth"."clinic_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can update customer notes for their clinic" ON "public"."customer_notes" FOR UPDATE TO "authenticated" USING (("clinic_id" IN ( SELECT "admin_auth"."clinic_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("clinic_id" IN ( SELECT "admin_auth"."clinic_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view customer notes for their clinic" ON "public"."customer_notes" FOR SELECT TO "authenticated" USING (("clinic_id" IN ( SELECT "admin_auth"."clinic_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."admin_auth" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_auth_read_own" ON "public"."admin_auth" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "audit_log_admin_read" ON "public"."security_audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_auth"
  WHERE (("admin_auth"."auth_user_id" = "auth"."uid"()) AND (("admin_auth"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "audit_log_service_insert" ON "public"."security_audit_log" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."balance_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "balance_adjustments_admin_delete" ON "public"."balance_adjustments" FOR DELETE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "balance_adjustments"."clinic_id"))));



CREATE POLICY "balance_adjustments_admin_insert" ON "public"."balance_adjustments" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "balance_adjustments"."clinic_id"))));



CREATE POLICY "balance_adjustments_admin_select" ON "public"."balance_adjustments" FOR SELECT USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "balance_adjustments"."clinic_id"))));



CREATE POLICY "balance_adjustments_admin_update" ON "public"."balance_adjustments" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "balance_adjustments"."clinic_id")))) WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "balance_adjustments"."clinic_id"))));



ALTER TABLE "public"."customer_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_items_admin_delete" ON "public"."invoice_items" FOR DELETE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "invoice_items"."clinic_id"))));



CREATE POLICY "invoice_items_admin_insert" ON "public"."invoice_items" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "invoice_items"."clinic_id"))));



CREATE POLICY "invoice_items_admin_select" ON "public"."invoice_items" FOR SELECT USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "invoice_items"."clinic_id"))));



CREATE POLICY "invoice_items_admin_update" ON "public"."invoice_items" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "invoice_items"."clinic_id")))) WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "invoice_items"."clinic_id"))));



ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_consumptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_consumptions_admin_delete" ON "public"."service_consumptions" FOR DELETE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_consumptions"."clinic_id"))));



CREATE POLICY "service_consumptions_admin_insert" ON "public"."service_consumptions" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_consumptions"."clinic_id"))));



CREATE POLICY "service_consumptions_admin_select" ON "public"."service_consumptions" FOR SELECT USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_consumptions"."clinic_id"))));



CREATE POLICY "service_consumptions_admin_update" ON "public"."service_consumptions" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_consumptions"."clinic_id")))) WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_consumptions"."clinic_id"))));



ALTER TABLE "public"."service_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_purchases_admin_delete" ON "public"."service_purchases" FOR DELETE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_purchases"."clinic_id"))));



CREATE POLICY "service_purchases_admin_insert" ON "public"."service_purchases" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_purchases"."clinic_id"))));



CREATE POLICY "service_purchases_admin_select" ON "public"."service_purchases" FOR SELECT USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_purchases"."clinic_id"))));



CREATE POLICY "service_purchases_admin_update" ON "public"."service_purchases" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_purchases"."clinic_id")))) WITH CHECK (("auth"."uid"() IN ( SELECT "admin_auth"."auth_user_id"
   FROM "public"."admin_auth"
  WHERE ("admin_auth"."clinic_id" = "service_purchases"."clinic_id"))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";

























































































































































REVOKE ALL ON FUNCTION "public"."_consume_from_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text", "p_variant_id" "uuid", "p_doctor_id" "uuid", "p_employee_id" "uuid") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."_is_staff_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."adjust_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_delta" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adjust_balance"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_delta" integer, "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_session_valid"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."consume_service"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text", "p_variant_id" "uuid", "p_doctor_id" "uuid", "p_employee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_service"("p_client_id" "uuid", "p_clinic_id" "uuid", "p_service_id" "uuid", "p_quantity" integer, "p_note" "text", "p_variant_id" "uuid", "p_doctor_id" "uuid", "p_employee_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_staff_user"("p_email" "text", "p_password" "text", "p_role" "text", "p_name" "text", "p_permissions" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."delete_daily_record"("p_type" "text", "p_id" "uuid", "p_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."delete_staff_user"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_clinic_id_for_user"("user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_my_auth_info"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_next_invoice_no"("p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_next_invoice_no"("p_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_staff_users"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mark_transaction_completed"("p_transaction_id" "uuid", "p_clinic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_transaction_completed"("p_transaction_id" "uuid", "p_clinic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."reset_staff_password"("p_user_id" "uuid", "p_new_password" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_clients"("p_clinic_id" "uuid", "p_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_clients"("p_clinic_id" "uuid", "p_query" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_staff_user"("p_user_id" "uuid", "p_role" "text", "p_name" "text", "p_permissions" "jsonb", "p_active" boolean) TO "authenticated";


















GRANT ALL ON TABLE "public"."admin_auth" TO "anon";
GRANT ALL ON TABLE "public"."admin_auth" TO "authenticated";



GRANT ALL ON TABLE "public"."balance_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."balance_adjustments" TO "authenticated";



GRANT ALL ON TABLE "public"."barbers" TO "anon";
GRANT ALL ON TABLE "public"."barbers" TO "authenticated";



GRANT ALL ON TABLE "public"."booking_integrity_backup" TO "anon";
GRANT ALL ON TABLE "public"."booking_integrity_backup" TO "authenticated";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";



GRANT ALL ON TABLE "public"."service_purchases" TO "anon";
GRANT ALL ON TABLE "public"."service_purchases" TO "authenticated";



GRANT ALL ON TABLE "public"."client_balance_summary" TO "anon";
GRANT ALL ON TABLE "public"."client_balance_summary" TO "authenticated";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";



GRANT ALL ON TABLE "public"."clinic" TO "anon";
GRANT ALL ON TABLE "public"."clinic" TO "authenticated";



GRANT ALL ON TABLE "public"."customer_notes" TO "anon";
GRANT ALL ON TABLE "public"."customer_notes" TO "authenticated";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";



GRANT ALL ON TABLE "public"."invoice_counters" TO "anon";
GRANT ALL ON TABLE "public"."invoice_counters" TO "authenticated";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."invoice_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."portal_settings" TO "anon";
GRANT ALL ON TABLE "public"."portal_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."portal_users" TO "anon";
GRANT ALL ON TABLE "public"."portal_users" TO "authenticated";



GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";



GRANT ALL ON TABLE "public"."service_consumptions" TO "anon";
GRANT ALL ON TABLE "public"."service_consumptions" TO "authenticated";



GRANT ALL ON TABLE "public"."service_variants" TO "anon";
GRANT ALL ON TABLE "public"."service_variants" TO "authenticated";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."visit_logs" TO "anon";
GRANT ALL ON TABLE "public"."visit_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."waiting_list" TO "anon";
GRANT ALL ON TABLE "public"."waiting_list" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";




























