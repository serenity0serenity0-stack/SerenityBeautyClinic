-- ============================================================================
-- DELETE UNKNOWN-CREATOR TRANSACTIONS (targeted, non-destructive to attributed data)
-- ----------------------------------------------------------------------------
-- Deletes only transactions whose created_by IS NULL ("Unknown Account").
-- Preserves all transactions attributed to a staff account.
-- Also cleans up related service_purchases, service_consumptions, invoice_items,
-- and adjusts client totals.
--
-- SAFETY:
--   - Wrapped in a transaction; rolls back on any error.
--   - Refuses to delete a sale whose balance was partially used
--     (remaining_quantity < total_quantity) to avoid corrupting balances.
--   - Only affects transactions with created_by IS NULL.
--   - Malak's and any other attributed transactions are preserved.
--
-- HOW TO RUN:
--   Paste into Supabase SQL editor and run. Review the counts in the NOTICE output.
-- ============================================================================

BEGIN;

-- 1. Guard: abort if any unknown transaction has partially used balance
DO $$
DECLARE
  v_partial_count int;
BEGIN
  SELECT COUNT(*) INTO v_partial_count
  FROM service_purchases sp
  JOIN transactions t ON t.id = sp.transaction_id
  WHERE t.created_by IS NULL
    AND sp.remaining_quantity < sp.total_quantity;
  IF v_partial_count > 0 THEN
    RAISE EXCEPTION 'Aborting: % unknown transaction(s) have partially used balances. Resolve manually first.', v_partial_count;
  END IF;
END $$;

-- 2. Remove service consumptions linked to those purchases
DELETE FROM service_consumptions
 WHERE purchase_id IN (
   SELECT sp.id FROM service_purchases sp
   JOIN transactions t ON t.id = sp.transaction_id
   WHERE t.created_by IS NULL
 );

-- 3. Remove service purchases
DELETE FROM service_purchases
 WHERE transaction_id IN (SELECT id FROM transactions WHERE created_by IS NULL);

-- 4. Remove invoice items
DELETE FROM invoice_items
 WHERE transaction_id IN (SELECT id FROM transactions WHERE created_by IS NULL);

-- 5. Adjust client totals (subtract the deleted transaction values)
UPDATE clients c
   SET total_spent  = GREATEST(COALESCE(total_spent, 0) - COALESCE(sub.totals, 0), 0),
       total_visits = GREATEST(COALESCE(total_visits, 0) - COALESCE(sub.cnt, 0), 0),
       updated_at   = NOW()
  FROM (
    SELECT client_id, SUM(total) AS totals, COUNT(*) AS cnt
      FROM transactions
     WHERE created_by IS NULL AND client_id IS NOT NULL
     GROUP BY client_id
  ) sub
 WHERE c.id = sub.client_id;

-- 6. Delete the unknown transactions
DELETE FROM transactions WHERE created_by IS NULL;

COMMIT;