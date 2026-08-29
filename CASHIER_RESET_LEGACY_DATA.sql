-- ============================================================================
-- CASHIER REWORK - RESET LEGACY DATA
-- The new cashier/ledger starts FRESH, so all old transactions, visit logs and
-- balance records are removed and client counters are zeroed.
--
-- Run this BEFORE CASHIER_SYSTEM_MIGRATION.sql.
-- This is DESTRUCTIVE - it deletes ALL historical income/visit data.
-- ============================================================================

BEGIN;

DELETE FROM invoice_items;
DELETE FROM service_purchases;
DELETE FROM service_consumptions;
DELETE FROM balance_adjustments;

-- transactions cascade-deletes invoice_items + service_purchases by FK
DELETE FROM transactions;

DELETE FROM visit_logs;

-- Zero the aggregated client counters to match the cleared history
UPDATE clients
   SET total_visits = 0,
       total_spent  = 0,
       last_visit   = NULL;

-- Move the invoice sequence back to the starting point (keeps numbers tidy)
ALTER SEQUENCE IF EXISTS invoice_seq RESTART WITH 1001;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT (SELECT COUNT(*) FROM transactions)  AS transactions_left,
       (SELECT COUNT(*) FROM visit_logs)    AS visit_logs_left,
       (SELECT COUNT(*) FROM clients)       AS clients_kept;