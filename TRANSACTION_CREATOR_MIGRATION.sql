-- ============================================================================
-- TRANSACTION CREATOR TRACKING (additive, non-destructive)
-- ----------------------------------------------------------------------------
-- Sets transactions.created_by to the authenticated user on insert when not
-- explicitly provided. This captures the staff account that processed each sale
-- (including sales created via the complete_sale RPC) without modifying the
-- RPC itself.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."transactions_set_created_by"()
RETURNS trigger
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_transactions_created_by" ON "public"."transactions";
CREATE TRIGGER "trg_transactions_created_by"
  BEFORE INSERT ON "public"."transactions"
  FOR EACH ROW EXECUTE FUNCTION "public"."transactions_set_created_by"();