-- ============================================================================
-- FIX #1 (distinct service-variant balances never merge) + FIX #3 (server-side
-- client search).  Part of the production "balance + POS" hardening.
--
-- PROBLEM :
--   A client buys 3 different packages sharing one base service_id
--   (e.g. 4هاف ارم / 4هاف ليج / 4بكيني ...).  service_purchases keeps ONE row
--   per bundle but ONLY links to the parent service_id, so the
--   client_balance_summary view GROUP BY (clinic_id, client_id, service_id)
--   MERGES them into a single 12-session balance.  Different service identities
--   must NEVER merge.
--
-- SOLUTION :
--   1. add variant_id to service_purchases (NOT NULL-ish; existing rows get a
--      sentinel on the parent service variant look-up by name when possible)
--   2. complete_sale now stores variant_id on each purchase row
--   3. client_balance_summary groups by (service_id, variant_id) so each
--      distinct variant is its own balance card.
--   4. NEW search_clients RPC : server-side ILIKE search on name / phone,
--      Arabic-numeral aware, clinic-isolated, capped at 20 rows.
--
-- Safe to run multiple times (idempotent).  Run AFTER
-- COMPLETION_AND_DAILY_INVOICE_MIGRATION.sql.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) service_purchases: add variant_id
-- ----------------------------------------------------------------------------
ALTER TABLE service_purchases ADD COLUMN IF NOT EXISTS variant_id UUID;

CREATE INDEX IF NOT EXISTS idx_service_purchases_variant_id
  ON service_purchases(variant_id);

-- Backfill: try to match an existing purchase to a variant by exact service-name
-- so legacy 4+4+4 rows split correctly.  Where the variant already carries the
-- same package banner as the parent service, keep it NULL (parent-level package).
DO $$
DECLARE
  r RECORD;
  v_variant_id UUID;
BEGIN
  FOR r IN
    SELECT sp.id, sp.service_id, sp.service_name
      FROM service_purchases sp
     WHERE sp.variant_id IS NULL
  LOOP
    SELECT id INTO v_variant_id
      FROM service_variants sv
     WHERE sv.service_id = r.service_id
       AND sv.isActive = true
       AND (sv.name IS NOT NULL)
       AND (COALESCE(sv.name, '') || '') <> ''
       AND r.service_name LIKE '%' || sv.name || '%'
     ORDER BY length(sv.name) DESC
     LIMIT 1;
    IF FOUND THEN
      UPDATE service_purchases SET variant_id = v_variant_id WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2) complete_sale : persist variant_id on the purchase row
--    (REPLACE the whole function so the new column is written atomically).
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
  v_vt_id UUID;          -- optional barber
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
  v_cursor_count INT := 0;
  v_line_total DECIMAL;
  i INT;
BEGIN
  -- Auth: caller must belong to the clinic
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

  -- Optional auto-complete today's active booking for this client
  SELECT id INTO v_booking_id FROM bookings
   WHERE client_id = p_client_id AND clinic_id = p_clinic_id
     AND status IN ('pending', 'confirmed', 'checked_in', 'ongoing')
     AND visit_date = v_date
   ORDER BY created_at ASC LIMIT 1;

  -- ---- Pass 1: compute subtotal server-side (client can't set prices)
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

  v_invoice_no := public.get_next_invoice_no(v_date);

  -- ---- Create transaction (invoice header)
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

    -- Create purchase rows for packages (one per bundle, each with its own expiry)
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

  INSERT INTO visit_logs (clinic_id, client_id, "visitDate", visit_date,
                          "visitTime", "servicesCount", total_spent, notes)
  VALUES (p_clinic_id, p_client_id, v_date, v_date, v_time,
          v_item_count, v_total, COALESCE(p_notes, 'بيع عبر الكاشير'));

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
-- 3) client_balance_summary : group by (service_id, variant_id) so every
--    distinct service identity is its own balance. Different identities never
--    merge.  The service_name shown is the purchase's own stored name (the most
--    precisely-labelled one), never MIN() which can hide variant names.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.client_balance_summary AS
SELECT
  clinic_id,
  client_id,
  service_id,
  variant_id,
  (array_agg(service_name ORDER BY length(service_name) DESC))[1] AS service_name,
  MIN(unit_label) AS unit_label,
  SUM(CASE WHEN status <> 'voided' THEN paid_quantity ELSE 0 END) AS purchased,
  SUM(CASE WHEN status <> 'voided' THEN bonus_quantity ELSE 0 END) AS bonus,
  SUM(CASE WHEN status = 'active' AND remaining_quantity > 0 THEN remaining_quantity ELSE 0 END) AS remaining,
  COUNT(*) FILTER (WHERE status = 'active' AND remaining_quantity > 0) AS active_purchases,
  MIN(CASE WHEN status = 'active' AND remaining_quantity > 0 THEN expiry_date END) AS earliest_expiry,
  COUNT(*) FILTER (WHERE status <> 'voided') AS total_purchases
FROM service_purchases
GROUP BY clinic_id, client_id, service_id, variant_id;

-- ----------------------------------------------------------------------------
-- 4) NEW search_clients RPC : server-side search, clinic-isolated, capped.
--    Searches name (prefix/contains), phone (contains, arabic-numeral aware by
--    normalizing both sides in SQL) and returns at most 20 rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_clients(
  p_clinic_id UUID,
  p_query TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.search_clients(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_clients(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- Reload the PostgREST schema cache so new/changed RPC signatures are available.
-- ----------------------------------------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');

END;