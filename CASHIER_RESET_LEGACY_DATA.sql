-- ============================================================================
-- CASHIER REWORK - RESET LEGACY DATA
-- The new cashier/ledger starts FRESH, so all old transactions, visit logs and
-- balance records are removed and client counters are zeroed.
--
-- Safe to run BEFORE or AFTER CASHIER_SYSTEM_MIGRATION.sql:
--   * New cashier tables (invoice_items, service_purchases, ...) are cleared
--     ONLY if they exist (guarded by IF EXISTS), so this works in either order.
--   * To restart numbering the invoice_seq must already exist => run the
--     migration first if you want the sequence restart to take effect.
--
-- RECOMMENDED ORDER: CASHIER_SYSTEM_MIGRATION.sql FIRST, then this reset.
-- This is DESTRUCTIVE - it deletes ALL historical income/visit data.
-- ============================================================================

BEGIN;

-- Clear new cashier tables only if the migration already created them
DO $$
BEGIN
  IF to_regclass('public.invoice_items') IS NOT NULL          THEN DELETE FROM invoice_items;          END IF;
  IF to_regclass('public.service_purchases') IS NOT NULL      THEN DELETE FROM service_purchases;      END IF;
  IF to_regclass('public.service_consumptions') IS NOT NULL   THEN DELETE FROM service_consumptions;   END IF;
  IF to_regclass('public.balance_adjustments') IS NOT NULL    THEN DELETE FROM balance_adjustments;    END IF;
  IF to_regclass('public.invoice_seq') IS NOT NULL            THEN ALTER SEQUENCE invoice_seq RESTART WITH 1001; END IF;
END $$;

-- transactions cascade-deletes invoice_items + service_purchases by FK
DELETE FROM transactions;

DELETE FROM visit_logs;

-- Zero the aggregated client counters to match the cleared history
UPDATE clients
   SET total_visits = 0,
       total_spent  = 0,
       last_visit   = NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT (SELECT COUNT(*) FROM transactions)  AS transactions_left,
       (SELECT COUNT(*) FROM visit_logs)    AS visit_logs_left,
       (SELECT COUNT(*) FROM clients)       AS clients_kept;