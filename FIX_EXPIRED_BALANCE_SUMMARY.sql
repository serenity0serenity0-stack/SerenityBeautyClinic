-- ============================================================================
-- FIX: client_balance_summary showed EXPIRED packages as available balance
-- ----------------------------------------------------------------------------
-- Symptom:  "العميل عنده 4 جلسات لكن عند الصرف يقول لا يوجد رصيد"
--           -> consume_service raised:  الرصيد غير كافٍ. المتاح: 0 المطلوب: 1
--
-- Cause:    client_balance_summary counted every row with
--               status = 'active' AND remaining_quantity > 0
--           regardless of expiry_date.
--           Meanwhile _consume_from_balance FIRST flips past-due lots to
--               status = 'expired'
--           and only then consumes from status = 'active' lots.
--           So an expired-but-not-yet-flipped lot was displayed in the UI
--           while being invisible to the consumption routine.
--
-- Evidence (from the 2026-10-02 dump): 127 of 749 balance identities disagreed,
-- many showing exactly 4 / 5 / 6 sessions that were not consumable.
--
-- Fix:      the view now applies the SAME expiry rule the RPC uses
--           (expiry_date IS NULL OR expiry_date >= today in Africa/Cairo),
--           and exposes expired_quantity so the UI can explain itself.
--
-- NOTE: DROP + CREATE (the view gains a column, so CREATE OR REPLACE is not
--       used here; this is the same pattern already used for this view).
-- Safe to re-run.
-- ============================================================================

DROP VIEW IF EXISTS public.client_balance_summary;

CREATE VIEW public.client_balance_summary AS
SELECT
  clinic_id,
  client_id,
  service_id,
  variant_id,
  (array_agg(service_name ORDER BY length(service_name) DESC))[1] AS service_name,
  MIN(unit_label) AS unit_label,

  SUM(CASE WHEN status <> 'voided' THEN paid_quantity   ELSE 0 END) AS purchased,
  SUM(CASE WHEN status <> 'voided' THEN bonus_quantity  ELSE 0 END) AS bonus,

  -- Available NOW: same expiry rule as _consume_from_balance
  SUM(CASE
        WHEN status = 'active'
         AND remaining_quantity > 0
         AND (expiry_date IS NULL OR expiry_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date)
        THEN remaining_quantity ELSE 0
      END) AS remaining,

  COUNT(*) FILTER (
        WHERE status = 'active'
          AND remaining_quantity > 0
          AND (expiry_date IS NULL OR expiry_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date)
  ) AS active_purchases,

  MIN(CASE
        WHEN status = 'active'
         AND remaining_quantity > 0
         AND (expiry_date IS NULL OR expiry_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date)
        THEN expiry_date
      END) AS earliest_expiry,

  -- Shown as "منتهي الصلاحية" so a 0-balance card is never a mystery
  SUM(CASE
        WHEN status = 'active'
         AND remaining_quantity > 0
         AND expiry_date IS NOT NULL
         AND expiry_date <  (NOW() AT TIME ZONE 'Africa/Cairo')::date
        THEN remaining_quantity ELSE 0
      END) AS expired_quantity,

  COUNT(*) FILTER (WHERE status <> 'voided') AS total_purchases

FROM service_purchases
GROUP BY clinic_id, client_id, service_id, variant_id;

GRANT SELECT ON public.client_balance_summary TO authenticated;

-- ----------------------------------------------------------------------------
-- Verification (run after applying):
--
-- 1) A customer that previously failed should now show 0 / منتهي:
--    SELECT client_id, service_name, remaining, expired_quantity, earliest_expiry
--      FROM client_balance_summary
--     WHERE remaining = 0 AND expired_quantity > 0
--     ORDER BY expired_quantity DESC LIMIT 20;
--
-- 2) The view must agree with what consume_service can actually take:
--    SELECT SUM(remaining) FROM client_balance_summary WHERE clinic_id = '<clinic>';
-- ----------------------------------------------------------------------------

-- ALTER TABLE service_purchases ALTER COLUMN ... (no schema change needed)
-- Rollback: re-run SERP_DISTINCT_BALANCES_AND_SEARCH.sql lines 327-346.
