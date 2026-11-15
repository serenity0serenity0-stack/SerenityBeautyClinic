-- ============================================================================
-- FIX: package "6بكيني و بكيني لاين و اندر ارم" expiry  1 month  ->  6 months
-- ----------------------------------------------------------------------------
-- service      : e32ee193-f136-452a-a0f9-d4296e41c6bd   (جلسات)
-- variant      : a8077358-15a6-4128-bd6b-ec76e4a820e8   (6 جلسات / 750 ج.م)
-- configured   : expiry_value = 1, expiry_unit = 'months'   <-- wrong, should be 6
-- consequence  : every lot died after ~30 days while the UI still showed it as
--                balance -> صرف جلسة raised "الرصيد غير كافٍ. المتاح: 0"
--
-- Impact when this was written (2026-10-02 dump, verified against all 862 lots):
--   * 270 lots on this variant, all created 2026-09-01 .. 2026-10-01
--   * 128 lots already expired = 451 sessions shown as balance but not spendable
--   * 254 lots still hold 942 sessions in total; NONE of them is older than
--     6 months, so extending the window re-enables all 942.
--   * every other variant in the system already uses expiry_value = 6 (verified:
--     stored expiry_date == purchase date + 6 months for all of them).
--
-- SAFE TO RE-RUN (see idempotency notes on each statement).
-- Run AFTER  FIX_EXPIRED_BALANCE_SUMMARY.sql  (that one fixes the view; this one
-- fixes the data). Run both.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) Backup the rows we are about to touch, so this is reversible.
--    CREATE TABLE IF NOT EXISTS keeps the ORIGINAL values if you re-run later.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expiry_fix_backup_20261008 AS
SELECT id, expiry_date, status FROM public.service_purchases WHERE FALSE;

INSERT INTO public.expiry_fix_backup_20261008 (id, expiry_date, status)
SELECT p.id, p.expiry_date, p.status
  FROM public.service_purchases p
 WHERE p.service_id    = 'e32ee193-f136-452a-a0f9-d4296e41c6bd'
   AND p.variant_id    = 'a8077358-15a6-4128-bd6b-ec76e4a820e8'
   AND p.remaining_quantity > 0
   AND p.status IN ('active', 'expired')
   AND NOT EXISTS (
         SELECT 1 FROM public.expiry_fix_backup_20261008 b WHERE b.id = p.id
       );

-- ----------------------------------------------------------------------------
-- 1) The configuration: new packages must last 6 months.
--    Idempotent: the WHERE clause makes it a no-op once set.
-- ----------------------------------------------------------------------------
UPDATE public.service_variants
   SET expiry_value  = 6,
       expiry_unit   = 'months',
       updated_at    = NOW()
 WHERE id            = 'a8077358-15a6-4128-bd6b-ec76e4a820e8'
   AND service_id    = 'e32ee193-f136-452a-a0f9-d4296e41c6bd'
   AND expiry_value IS DISTINCT FROM 6;

-- ----------------------------------------------------------------------------
-- 2) Existing lots: give them the full 6-month window from their purchase date.
--
--    GREATEST() is what makes this re-runnable: once a lot already reaches
--    purchase + 6 months, re-running computes the same value and changes
--    nothing (so no lot is ever extended twice).
--
--    Purchase date is taken as the moment it happened in Cairo, which is how
--    complete_sale originally computed expiry_date.
-- ----------------------------------------------------------------------------
UPDATE public.service_purchases
   SET expiry_date = GREATEST(
         expiry_date,
         ((created_at AT TIME ZONE 'utc') AT TIME ZONE 'Africa/Cairo')::date
           + INTERVAL '6 months'
       )::date,
       updated_at  = NOW()
 WHERE service_id    = 'e32ee193-f136-452a-a0f9-d4296e41c6bd'
   AND variant_id    = 'a8077358-15a6-4128-bd6b-ec76e4a820e8'
   AND remaining_quantity > 0
   AND status IN ('active', 'expired')
   AND expiry_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3) Lots that consume_service already flipped to 'expired' during a failed
--    attempt come back to 'active' now that their expiry is in the future.
--    Idempotent: only touches rows whose expiry is already valid.
-- ----------------------------------------------------------------------------
UPDATE public.service_purchases
   SET status = 'active',
       updated_at = NOW()
 WHERE service_id    = 'e32ee193-f136-452a-a0f9-d4296e41c6bd'
   AND variant_id    = 'a8077358-15a6-4128-bd6b-ec76e4a820e8'
   AND remaining_quantity > 0
   AND status        = 'expired'
   AND expiry_date  >= (NOW() AT TIME ZONE 'Africa/Cairo')::date;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------

-- 1) Config must read 6 / months
--    SELECT expiry_value, expiry_unit FROM service_variants
--     WHERE id = 'a8077358-15a6-4128-bd6b-ec76e4a820e8';

-- 2) Nothing left expired on this variant:
--    SELECT COUNT(*) AS still_expired_lots,
--           COALESCE(SUM(remaining_quantity),0) AS still_expired_sessions
--      FROM service_purchases
--     WHERE service_id = 'e32ee193-f136-452a-a0f9-d4296e41c6bd'
--       AND variant_id = 'a8077358-15a6-4128-bd6b-ec76e4a820e8'
--       AND remaining_quantity > 0
--       AND status = 'active'
--       AND expiry_date < (NOW() AT TIME ZONE 'Africa/Cairo')::date;
--    -> expect 0 rows.

-- 3) The UI and the RPC must now agree for a customer who failed before:
--    SELECT client_id, service_name, remaining, expired_quantity, earliest_expiry
--      FROM client_balance_summary
--     WHERE variant_id = 'a8077358-15a6-4128-bd6b-ec76e4a820e8'
--     ORDER BY remaining DESC;
--    -> expired_quantity must be 0 and remaining = real spendable sessions.

-- ----------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- UPDATE service_purchases p
--    SET expiry_date = b.expiry_date, status = b.status
--   FROM public.expiry_fix_backup_20261008 b WHERE p.id = b.id;
-- UPDATE service_variants SET expiry_value = 1, expiry_unit = 'months'
--  WHERE id = 'a8077358-15a6-4128-bd6b-ec76e4a820e8';
-- DROP TABLE public.expiry_fix_backup_20261008;
