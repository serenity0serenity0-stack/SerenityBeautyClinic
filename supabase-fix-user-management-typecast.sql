-- ============================================================================
-- FIX: LOGIN FAILURE - get_my_auth_info / get_staff_users return-type mismatch
-- ============================================================================
-- Root cause:
--   admin_auth.email is character varying  (varchar)
--   admin_auth.role  is character varying  (varchar)
-- but the new functions declared:
--     RETURNS TABLE (..., email text, role text, ...)
-- In a plpgsql "RETURN QUERY", Postgres requires the SELECT column types to be
-- binary-coercible to the declared OUT columns. varchar -> text is NOT, so any
-- call failed with:
--     ERROR 42804: structure of query does not match function result type
--     DETAIL: Returned type character varying does not match expected type text
-- in column 1 (role).
--
-- Fix: drop any (possibly overloaded) copies, then recreate with explicit
-- ::text casts on the varchar columns.
--
-- Paste this in the Supabase SQL editor and run it once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Drop EVERY version of these functions (handles accidental overloads)
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('get_my_auth_info', 'get_staff_users')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2) Recreate get_my_auth_info() with explicit ::text casts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_auth_info()
RETURNS TABLE (
  role text,
  name text,
  permissions jsonb,
  clinic_id uuid,
  active boolean,
  email text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.role::text,
         a.name,
         a.permissions,
         a.clinic_id,
         a.active,
         a.email::text
  FROM public.admin_auth a
  WHERE a.auth_user_id = auth.uid();
END;
$$;

-- ----------------------------------------------------------------------------
-- 3) Recreate get_staff_users() with explicit ::text casts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_users()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  role text,
  active boolean,
  permissions jsonb,
  password text,
  auth_user_id uuid,
  created_at timestamp without time zone
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can view users';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.email::text,
         a.name,
         a.role::text,
         a.active,
         a.permissions,
         a.password,
         a.auth_user_id,
         a.created_at
  FROM public.admin_auth a
  WHERE a.clinic_id = v_clinic_id
  ORDER BY a.role = 'admin' DESC, a.created_at ASC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) Re-grant execute
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_my_auth_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_users() TO authenticated;

-- ----------------------------------------------------------------------------
-- 5) Verification
-- ----------------------------------------------------------------------------
-- (a) Exactly one signature per function (no overloads)
SELECT p.oid::regprocedure AS function_signature
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('get_my_auth_info', 'get_staff_users')
ORDER BY 1;

-- (b) The previously-failing cast paths now type-check (no 42804)
SELECT a.role::text, a.email::text
FROM public.admin_auth a
LIMIT 5;

-- (c) Smoke test. NOTE: when run from the SQL editor (as postgres, no JWT),
--     auth.uid() is NULL so this returns 0 rows - but it must NOT throw 42804.
--     The real pass-through happens via the app (authenticated RPC).
SELECT * FROM public.get_my_auth_info();

SELECT '✅ get_my_auth_info + get_staff_users type-cast fix applied' AS status;
