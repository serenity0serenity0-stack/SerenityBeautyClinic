-- ============================================================================
-- CASHIER + SERVICE PACKAGES + CLIENT BALANCE SYSTEM
-- Run this in the Supabase SQL Editor.
-- Do NOT run it multiple times blindly - it is idempotent (IF NOT EXISTS).
-- (Optional) run CASHIER_RESET_LEGACY_DATA.sql BEFORE this if you want to
-- wipe old transactions/visits first. Recommended before go-live.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) EXTEND THE SERVICES CATALOG (fixed bundles, bonus, expiry)
--    service_type  : 'regular' (one-off, no balance) | 'package' (tracked in balance)
--    unit_label    : 'جلسة' / 'نبضة' / anything the admin types (packages only)
--    package_quantity : e.g. 4 جلسات or 1000 نبضة (packages only)
--    bonus_quantity : fixed extra granted to balance per bundle (e.g. 150 نبضة)
--    expiry_value + expiry_unit (days/weeks/months) : package expiry, per purchase
-- ============================================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'regular';
ALTER TABLE services ADD COLUMN IF NOT EXISTS unit_label VARCHAR(20);
ALTER TABLE services ADD COLUMN IF NOT EXISTS package_quantity INT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS bonus_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS expiry_value INT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS expiry_unit VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_service_type_check'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_service_type_check
      CHECK (service_type IN ('regular', 'package'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_expiry_unit_check'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_expiry_unit_check
      CHECK (expiry_unit IS NULL OR expiry_unit IN ('days', 'weeks', 'months'));
  END IF;
END $$;

-- ============================================================================
-- 2) INVOICE NUMBERING ON TRANSACTIONS
-- ============================================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS invoice_no BIGINT;

CREATE SEQUENCE IF NOT EXISTS invoice_seq START WITH 1001;
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no ON transactions(invoice_no);

-- ============================================================================
-- 3) NEW TABLES
-- ============================================================================

-- 3a. invoice_items : one row per cart line on an invoice
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(20) NOT NULL DEFAULT 'regular',
  unit_label VARCHAR(20),
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  bonus_quantity INT NOT NULL DEFAULT 0,
  line_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_clinic_id ON invoice_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_transaction_id ON invoice_items(transaction_id);

-- 3b. service_purchases : one row per sold bundle (kept separately, own expiry)
--     paid_quantity  : what the client paid for (e.g. 1000 نبضة)
--     bonus_quantity : fixed bonus granted (e.g. 150 نبضة)
--     total_quantity / remaining_quantity : balance arithmetic
--     status         : active | fully_used | expired | voided | adjustment
CREATE TABLE IF NOT EXISTS service_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  unit_label VARCHAR(20),
  paid_quantity INT NOT NULL,
  bonus_quantity INT NOT NULL DEFAULT 0,
  total_quantity INT NOT NULL,
  remaining_quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expiry_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_purchases_clinic_id ON service_purchases(clinic_id);
CREATE INDEX IF NOT EXISTS idx_service_purchases_client_id ON service_purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_service_purchases_service_id ON service_purchases(service_id);
CREATE INDEX IF NOT EXISTS idx_service_purchases_balance
  ON service_purchases(client_id, service_id, status, expiry_date);

-- 3c. service_consumptions : every time balance is used (session/pulse consumed)
CREATE TABLE IF NOT EXISTS service_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES service_purchases(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  unit_label VARCHAR(20),
  quantity INT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_service_consumptions_client_id ON service_consumptions(client_id);
CREATE INDEX IF NOT EXISTS idx_service_consumptions_clinic_id ON service_consumptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_service_consumptions_purchase_id ON service_consumptions(purchase_id);

-- 3d. balance_adjustments : admin manual +/- ledger (audit trail)
CREATE TABLE IF NOT EXISTS balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  unit_label VARCHAR(20),
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_client_id ON balance_adjustments(client_id);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_clinic_id ON balance_adjustments(clinic_id);

-- ============================================================================
-- 4) CLIENT BALANCE SUMMARY VIEW (single source of truth for balances)
-- ============================================================================
CREATE OR REPLACE VIEW public.client_balance_summary AS
SELECT
  clinic_id,
  client_id,
  service_id,
  MIN(service_name) AS service_name,
  MIN(unit_label) AS unit_label,
  SUM(CASE WHEN status <> 'voided' THEN paid_quantity ELSE 0 END) AS purchased,
  SUM(CASE WHEN status <> 'voided' THEN bonus_quantity ELSE 0 END) AS bonus,
  SUM(CASE WHEN status = 'active' AND remaining_quantity > 0 THEN remaining_quantity ELSE 0 END) AS remaining,
  COUNT(*) FILTER (WHERE status = 'active' AND remaining_quantity > 0) AS active_purchases,
  MIN(CASE WHEN status = 'active' AND remaining_quantity > 0 THEN expiry_date END) AS earliest_expiry
FROM service_purchases
GROUP BY clinic_id, client_id, service_id;

-- ============================================================================
-- 5) RPC FUNCTIONS
-- ============================================================================

-- 5a. Complete a sale ATOMICALLY:
--     - server-side pricing from the catalog (client can't set prices)
--     - creates transaction + invoice_items
--     - creates service_purchases (one per bundle, per-purchase expiry) for packages
--     - updates client counters / visit log / auto-completes today's booking
--     p_items = [{ "service_id": uuid, "quantity": 1, "variant_id": uuid|null }]
CREATE OR REPLACE FUNCTION public.complete_sale(
  p_client_id UUID,
  p_clinic_id UUID,
  p_items JSONB,
  p_discount DECIMAL DEFAULT 0,
  p_discount_type VARCHAR DEFAULT 'fixed',
  p_payment_method VARCHAR DEFAULT 'cash',
  p_barber_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
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
  v_line_total DECIMAL(10,2);
  v_expiry DATE;
  v_purchase_ids JSONB;
  v_item_count INT;
  v_items_json JSONB := '[]'::jsonb;
  v_bundle JSONB;
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

  -- Today's active booking for this client (auto-complete after payment)
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
  v_invoice_no := nextval('invoice_seq');

  -- ---- Create transaction (invoice header)
  INSERT INTO transactions (
    clinic_id, client_id, booking_id, client_name, client_phone,
    barber_id, barber_name, amount, discount, discount_type, total,
    payment_method, status, description, date, time, items, subtotal,
    visit_number, invoice_no
  ) VALUES (
    p_clinic_id, p_client_id, v_booking_id, v_client.name, v_client.phone,
    p_barber_id, v_barber_name, v_subtotal, v_discount_amount, p_discount_type, v_total,
    p_payment_method, 'completed', p_notes, v_date, v_time, p_items, v_subtotal,
    v_visit_number, v_invoice_no
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

    IF (v_line.item->>'variant_id') IS NOT NULL THEN
      SELECT * INTO v_variant FROM service_variants
       WHERE id = (v_line.item->>'variant_id')::UUID
         AND service_id = v_service.id AND clinic_id = p_clinic_id AND isActive = true;
      IF FOUND THEN
        v_price := COALESCE(v_variant.price, v_price);
        v_name := v_name || ' - ' || COALESCE(v_variant.name, '');
      END IF;
    END IF;

    v_line_total := ROUND((v_price * v_qty)::numeric, 2);

    v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
      'service_id', v_service.id,
      'name', v_name,
      'price', v_price,
      'quantity', v_qty,
      'unit_label', v_service.unit_label,
      'bonus_quantity', COALESCE(v_service.bonus_quantity, 0),
      'service_type', v_service.service_type,
      'line_total', v_line_total
    ));

    INSERT INTO invoice_items (
      clinic_id, transaction_id, service_id, service_name, service_type,
      unit_label, unit_price, quantity, bonus_quantity, line_total
    ) VALUES (
      p_clinic_id, v_tx_id, v_service.id, v_name, v_service.service_type,
      v_service.unit_label, v_price, v_qty, COALESCE(v_service.bonus_quantity, 0), v_line_total
    );

    -- Create purchase rows for packages (one per bundle, each with its own expiry)
    IF v_service.service_type = 'package'
       AND COALESCE(v_service.package_quantity, 0) > 0 THEN
      v_expiry := NULL;
      IF v_service.expiry_value IS NOT NULL AND v_service.expiry_unit IS NOT NULL THEN
        v_expiry := v_date + (v_service.expiry_value || ' ' || v_service.expiry_unit)::INTERVAL;
      END IF;

      FOR i IN 1..v_qty LOOP
        INSERT INTO service_purchases (
          clinic_id, client_id, transaction_id, service_id, service_name, unit_label,
          paid_quantity, bonus_quantity, total_quantity, remaining_quantity,
          unit_price, amount, expiry_date, status
        ) VALUES (
          p_clinic_id, p_client_id, v_tx_id, v_service.id, v_name, v_service.unit_label,
          v_service.package_quantity, COALESCE(v_service.bonus_quantity, 0),
          v_service.package_quantity + COALESCE(v_service.bonus_quantity, 0),
          v_service.package_quantity + COALESCE(v_service.bonus_quantity, 0),
          v_price, v_price, v_expiry, 'active'
        );
      END LOOP;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
    INTO v_purchase_ids
    FROM service_purchases WHERE transaction_id = v_tx_id;

  UPDATE transactions SET items = v_items_json WHERE id = v_tx_id;

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

  -- ---- Auto-complete today's active booking
  IF v_booking_id IS NOT NULL THEN
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

-- 5b. Internal balance consumption helper (EARLIEST-EXPIRY-FIRST)
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
           sp.service_name AS sp_name, COALESCE(s."nameAr", s.name, sp.service_name) AS svc_name
      FROM service_purchases sp
      LEFT JOIN services s ON s.id = sp.service_id
     WHERE sp.clinic_id = p_clinic_id AND sp.client_id = p_client_id
       AND sp.service_id = p_service_id
       AND sp.status = 'active' AND sp.remaining_quantity > 0
     ORDER BY sp.expiry_date ASC NULLS LAST, sp.created_at ASC
    FOR UPDATE
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

    v_qty := v_qty - v_used;
  END LOOP;

  IF v_qty > 0 THEN
    RAISE EXCEPTION 'الرصيد غير كافٍ. المتاح: % المطلوب: %', p_quantity - v_qty, p_quantity;
  END IF;

  RETURN p_quantity;
END;
$$;

-- 5c. consume_service : public API for using balance (sessions/pulses)
CREATE OR REPLACE FUNCTION public.consume_service(
  p_client_id UUID,
  p_clinic_id UUID,
  p_service_id UUID,
  p_quantity INT,
  p_note TEXT DEFAULT NULL
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

  RETURN public._consume_from_balance(p_client_id, p_clinic_id, p_service_id, p_quantity, p_note);
END;
$$;

-- 5d. adjust_balance : admin manual +/- (audited). Positive adds; negative removes.
CREATE OR REPLACE FUNCTION public.adjust_balance(
  p_client_id UUID,
  p_clinic_id UUID,
  p_service_id UUID,
  p_delta INT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_service(UUID, UUID, UUID, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_balance(UUID, UUID, UUID, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._consume_from_balance(UUID, UUID, UUID, INT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, JSONB, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_service(UUID, UUID, UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_balance(UUID, UUID, UUID, INT, TEXT) TO authenticated;

-- ============================================================================
-- 6) RLS + POLICIES (mirrors the admin_auth clinic-isolation pattern used
--    everywhere else in this project)
-- ============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['invoice_items', 'service_purchases', 'service_consumptions', 'balance_adjustments'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_admin_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_admin_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_admin_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_admin_delete', t);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = %I.clinic_id));',
      t || '_admin_select', t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = %I.clinic_id));',
      t || '_admin_insert', t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = %I.clinic_id)) WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = %I.clinic_id));',
      t || '_admin_update', t, t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = %I.clinic_id));',
      t || '_admin_delete', t, t
    );
  END LOOP;
END $$;

GRANT SELECT ON public.invoice_items TO authenticated;
GRANT SELECT ON public.service_purchases TO authenticated;
GRANT SELECT ON public.service_consumptions TO authenticated;
GRANT SELECT ON public.balance_adjustments TO authenticated;
GRANT SELECT ON public.client_balance_summary TO authenticated;

-- ============================================================================
-- 7) MAKE SURE visit_logs HAS THE COLUMNS THE APP USES
-- ============================================================================
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS "visitDate" DATE;
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS "visitTime" VARCHAR(5) DEFAULT '00:00';
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS "servicesCount" INTEGER DEFAULT 0;
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- 8) VERIFICATION
-- ============================================================================
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'services' AND column_name IN
   ('service_type','unit_label','package_quantity','bonus_quantity','expiry_value','expiry_unit')
 ORDER BY column_name;

SELECT '--- new tables ---' AS check;
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name IN
   ('invoice_items','service_purchases','service_consumptions','balance_adjustments')
 ORDER BY table_name;

SELECT '--- RPC functions ---' AS check;
SELECT routine_name FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name IN ('complete_sale','consume_service','adjust_balance','_consume_from_balance')
 ORDER BY routine_name;

SELECT '--- balance view ---' AS check;
SELECT COUNT(*) AS balance_summary_view_rows FROM (
  SELECT 1 FROM public.client_balance_summary LIMIT 1
) x;

COMMIT;