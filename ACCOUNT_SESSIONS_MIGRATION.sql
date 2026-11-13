-- ============================================================================
-- ACCOUNT SESSIONS MIGRATION (additive, non-destructive)
-- ----------------------------------------------------------------------------
-- Tracks login/logout sessions per staff account for usage analytics.
-- Required for the Accounts Activity & Analytics dashboard.
--
-- SAFETY:
--   - New table only. No changes to existing tables.
--   - Idempotent.
--   - RLS enabled: users can only read their own clinic's sessions;
--     admins see all sessions in their clinic.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."account_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "clinic_id" "uuid",
    "session_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "login_at" timestamp with time zone NOT NULL DEFAULT now(),
    "logout_at" timestamp with time zone,
    "duration_seconds" bigint,
    "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "account_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_sessions_session_id_key" UNIQUE ("session_id"),
    CONSTRAINT "account_sessions_status_check" CHECK (status IN ('ACTIVE','COMPLETED','INTERRUPTED','UNKNOWN'))
);

CREATE INDEX IF NOT EXISTS "idx_account_sessions_user_id" ON "public"."account_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_account_sessions_clinic_id" ON "public"."account_sessions" ("clinic_id");
CREATE INDEX IF NOT EXISTS "idx_account_sessions_login_at" ON "public"."account_sessions" ("login_at");
CREATE INDEX IF NOT EXISTS "idx_account_sessions_status" ON "public"."account_sessions" ("status");

ALTER TABLE "public"."account_sessions" ENABLE ROW LEVEL SECURITY;

-- Users can read sessions in their own clinic
DROP POLICY IF EXISTS "account_sessions_select_clinic" ON "public"."account_sessions";
CREATE POLICY "account_sessions_select_clinic" ON "public"."account_sessions"
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.admin_auth WHERE auth_user_id = auth.uid())
  );

-- Only the authenticated user can insert their own session
DROP POLICY IF EXISTS "account_sessions_insert_own" ON "public"."account_sessions";
CREATE POLICY "account_sessions_insert_own" ON "public"."account_sessions"
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- Only the session owner can update (logout) their own session
DROP POLICY IF EXISTS "account_sessions_update_own" ON "public"."account_sessions";
CREATE POLICY "account_sessions_update_own" ON "public"."account_sessions"
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Allow beforeunload to mark a session interrupted without user auth
CREATE OR REPLACE FUNCTION "public"."mark_session_interrupted"("p_session_id" "uuid")
RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.account_sessions
     SET status = 'INTERRUPTED'
   WHERE session_id = p_session_id
     AND status = 'ACTIVE';
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."mark_session_interrupted"("uuid") TO anon, authenticated;

-- Auto-compute duration_seconds on logout
CREATE OR REPLACE FUNCTION "public"."account_sessions_set_duration"()
RETURNS trigger
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.logout_at IS NOT NULL AND (OLD.logout_at IS NULL OR NEW.logout_at IS DISTINCT FROM OLD.logout_at) THEN
    NEW.duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.logout_at - NEW.login_at))::bigint);
    IF NEW.status = 'ACTIVE' THEN
      NEW.status := 'COMPLETED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_account_sessions_duration" ON "public"."account_sessions";
CREATE TRIGGER "trg_account_sessions_duration"
  BEFORE UPDATE ON "public"."account_sessions"
  FOR EACH ROW EXECUTE FUNCTION "public"."account_sessions_set_duration"();
