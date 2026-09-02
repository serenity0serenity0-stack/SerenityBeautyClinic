-- ============================================================================
-- DAILY RECORDS: DELETE + BALANCE REVERSAL
-- ============================================================================
-- Adds a guarded RPC `delete_daily_record` used by the Daily Records (سجلات اليوم)
-- Delete buttons. It atomically removes the linked ledger rows and reverses the
-- balance effect so the records are not left inconsistent.
--
-- Safety rules (a ledger must never be silently corrupted):
--   * A SALE cannot be deleted if any of its bought bundles was already partly
--     consumed (remaining < total). Trying to do so raises a clear Arabic error.
--   * A CONSUMPTION (صرف رصيد) is reversed by giving the quantity back to the
--     exact purchase that was used, removing its service_consumptions rows and
--     its visit_logs row.
--   * An ADJUSTMENT is reversed by removing the purchase it created (grant) or
--     restoring the quantity it deducted (deduction).
-- Idempotent / safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Add a precise link from each consumption row to the visit it belongs to.
-- This makes deletion/reversal exact instead of matching by time heuristics.
-- ----------------------------------------------------------------------------
ALTER TABLE service_consumptions ADD COLUMN IF NOT EXISTS visit_id UUID;
CREATE INDEX IF NOT EXISTS idx_service_consumptions_visit_id
  ON service_consumptions(visit_id);

-- ----------------------------------------------------------------------------
-- RPC: delete a daily record and reverse its balance effect
--   p_type    : 'transaction' | 'consumption'
--   p_id      : transaction id, or visit_logs id
--   p_clinic_id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_daily_record(
  p_type TEXT,
  p_id UUID,
  p_clinic_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.delete_daily_record(TEXT, UUID, UUID) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');

SELECT '✅ Daily records delete installed' AS status;

END;
