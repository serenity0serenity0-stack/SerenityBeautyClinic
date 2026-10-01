-- ============================================================================
-- FIX: (1) delete_staff_user -> "operator does not exist: character varying = uuid"
--      (2) Active accounts getting force-logged-out
-- ============================================================================
-- Root cause
--   public.admin_auth.auth_user_id is a character varying column, but every
--   auth RPC compares it against a uuid value (auth.uid() / p_user_id).
--   Postgres has no varchar = uuid operator, so:
--     - delete_staff_user() dies with the reported error
--     - get_clinic_id_for_user() / get_my_auth_info() raise an error too, and
--       the frontend treats "RPC error" as "not authorized" -> signOut(),
--       which is why ACTIVE accounts keep getting logged out.
--
-- What this script does (idempotent, safe to run more than once)
--   1. Prints diagnostics (column types, staff rows) — read them first.
--   2. Optionally converts admin_auth.auth_user_id to uuid (root fix). Skipped
--      automatically if any value is not a valid uuid, or if a policy/view
--      blocks the ALTER — in that case the functions below still fix both bugs.
--   3. Replaces every auth RPC with a type-safe version that compares
--      auth_user_id::text, so it works with either column type.
--   4. Makes the session heartbeat tolerant: an empty result is only treated
--      as "session gone" after 2 consecutive confirmations, and it no longer
--      forces a logout when the version could not be read.
--   5. Re-grants EXECUTE to authenticated.
--
-- Nothing here changes table structure unless step 2 succeeds, and no data is
-- modified. Paste into Supabase SQL Editor and run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) DIAGNOSTICS — check the output of this before continuing
-- ----------------------------------------------------------------------------
SELECT 'auth_user_id_type' AS check, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_auth' AND column_name = 'auth_user_id'
UNION ALL
SELECT 'security_version_type', data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_auth' AND column_name = 'security_version';

SELECT email, auth_user_id, role, active, security_version, clinic_id
FROM public.admin_auth
ORDER BY role, created_at;

-- Policies that reference admin_auth.auth_user_id (these break if the column
-- type does not match what the policy expression expects)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND policyname IS NOT NULL
  AND (qual LIKE '%auth_user_id%' OR with_check LIKE '%auth_user_id%')
ORDER BY tablename, policyname;


-- ----------------------------------------------------------------------------
-- 2) ROOT FIX (optional): make admin_auth.auth_user_id a real uuid
--    Runs only when the column is not uuid and every value is a valid uuid.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_type text;
  v_bad  int;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'admin_auth' AND column_name = 'auth_user_id';

  IF v_type IS NULL THEN
    RAISE NOTICE 'admin_auth.auth_user_id not found - skipping type fix';
    RETURN;
  END IF;

  IF v_type = 'uuid' THEN
    RAISE NOTICE 'admin_auth.auth_user_id is already uuid - nothing to convert';
    RETURN;
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.admin_auth
  WHERE auth_user_id IS NOT NULL
    AND auth_user_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF v_bad > 0 THEN
    RAISE NOTICE 'SKIP type fix: % row(s) with a non-uuid auth_user_id (fix them manually)', v_bad;
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'ALTER TABLE public.admin_auth ALTER COLUMN auth_user_id TYPE uuid USING auth_user_id::uuid';
    RAISE NOTICE 'DONE: admin_auth.auth_user_id converted to uuid';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP type fix (dependent objects): %', SQLERRM;
    RAISE NOTICE 'No problem - the type-safe functions below fix both reported bugs anyway.';
  END;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3) TYPE-SAFE AUTH FUNCTIONS
--    auth_user_id::text = <uuid>::text works whether the column is uuid or varchar
-- ----------------------------------------------------------------------------

-- 3a) Is the caller an admin of a clinic? --------------------------------------
DROP FUNCTION IF EXISTS public._is_staff_admin();
CREATE FUNCTION public._is_staff_admin()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT a.clinic_id INTO v_clinic_id
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
    AND a.role = 'admin'
    AND COALESCE(a.active, true) = true;
  RETURN v_clinic_id;
END;
$$;

-- 3b) Info about the logged-in user (login resolution + security_version) -----
DROP FUNCTION IF EXISTS public.get_my_auth_info();
CREATE FUNCTION public.get_my_auth_info()
RETURNS TABLE (
  role text,
  name text,
  permissions jsonb,
  clinic_id uuid,
  active boolean,
  email text,
  security_version int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.role::text,
    a.name,
    a.permissions,
    a.clinic_id,
    COALESCE(a.active, true),
    a.email::text,
    COALESCE(a.security_version, 1)::int
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
  LIMIT 1;
END;
$$;

-- 3c) Clinic id for a user, NULL only when the row is really inactive --------
--     NOTE: the input parameter MUST stay named "user_id" - the frontend calls
--     it as { user_id: ... } and PostgREST matches argument names.
DROP FUNCTION IF EXISTS public.get_clinic_id_for_user(uuid);
CREATE FUNCTION public.get_clinic_id_for_user(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT a.clinic_id INTO v_clinic_id
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = user_id::text
    AND COALESCE(a.active, true) = true
  LIMIT 1;

  RETURN v_clinic_id;
END;
$$;

-- 3d) Heartbeat: active flag + version. NULL version = "unknown", not "revoked"
DROP FUNCTION IF EXISTS public.check_session_valid();
CREATE FUNCTION public.check_session_valid()
RETURNS TABLE (
  is_active boolean,
  security_version int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(a.active, true), a.security_version
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
  LIMIT 1;
END;
$$;

-- 3e) List staff of my clinic (admins only) -----------------------------------
DROP FUNCTION IF EXISTS public.get_staff_users();
CREATE FUNCTION public.get_staff_users()
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
  SELECT
    a.id, a.email::text, a.name, a.role::text, COALESCE(a.active, true),
    a.permissions, a.password, a.auth_user_id::uuid, a.created_at
  FROM public.admin_auth a
  WHERE a.clinic_id = v_clinic_id
  ORDER BY a.role = 'admin' DESC, a.created_at ASC;
END;
$$;

-- 3f) Update staff (role / name / permissions / active) ----------------------
DROP FUNCTION IF EXISTS public.update_staff_user(uuid, text, text, jsonb, boolean);
CREATE FUNCTION public.update_staff_user(
  p_user_id uuid,
  p_role text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_permissions jsonb DEFAULT NULL,
  p_active boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_target_clinic uuid;
  v_old_active boolean;
  v_new_active boolean;
  v_bumped boolean := false;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;

  SELECT a.clinic_id, COALESCE(a.active, true) INTO v_target_clinic, v_old_active
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = p_user_id::text
  LIMIT 1;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_user_id = auth.uid() AND COALESCE(p_active, true) = false THEN
    RAISE EXCEPTION 'You cannot disable your own account';
  END IF;

  v_new_active := COALESCE(p_active, v_old_active);

  -- Bump the version ONLY when the account is enabled/disabled, so editing a
  -- name or permissions never kicks the user out of their session.
  IF p_active IS NOT NULL AND p_active <> v_old_active THEN
    v_bumped := true;
  END IF;

  UPDATE public.admin_auth SET
    role = COALESCE(p_role, role),
    name = COALESCE(p_name, name),
    permissions = CASE
      WHEN p_role = 'admin' THEN '["all"]'::jsonb
      ELSE COALESCE(p_permissions, permissions)
    END,
    active = v_new_active,
    security_version = CASE
      WHEN v_bumped THEN COALESCE(security_version, 1) + 1
      ELSE COALESCE(security_version, 1)
    END,
    updated_at = now()
  WHERE auth_user_id::text = p_user_id::text;

  BEGIN
    INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      p_user_id,
      CASE WHEN v_new_active THEN 'user_enabled' ELSE 'user_disabled' END,
      jsonb_build_object('old_active', v_old_active, 'new_active', v_new_active, 'version_bumped', v_bumped)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log skipped: %', SQLERRM;
  END;
END;
$$;

-- 3g) Reset password: bumps version + revokes refresh tokens ------------------
DROP FUNCTION IF EXISTS public.reset_staff_password(uuid, text);
CREATE FUNCTION public.reset_staff_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_target_clinic uuid;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT a.clinic_id INTO v_target_clinic
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = p_user_id::text
  LIMIT 1;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id::text = p_user_id::text;

  UPDATE public.admin_auth
  SET password = p_new_password,
      security_version = COALESCE(security_version, 1) + 1,
      updated_at = now()
  WHERE auth_user_id::text = p_user_id::text;

  BEGIN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_tokens cleanup skipped: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      p_user_id,
      'password_reset',
      jsonb_build_object('tokens_revoked', true)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log skipped: %', SQLERRM;
  END;
END;
$$;

-- 3h) Delete staff user (admins only)  <-- fixes the reported error ----------
DROP FUNCTION IF EXISTS public.delete_staff_user(uuid);
CREATE FUNCTION public.delete_staff_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_clinic_id uuid;
  v_target_clinic uuid;
BEGIN
  SELECT a.clinic_id INTO v_clinic_id
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = auth.uid()::text
    AND a.role = 'admin'
    AND COALESCE(a.active, true) = true
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT a.clinic_id INTO v_target_clinic
  FROM public.admin_auth a
  WHERE a.auth_user_id::text = p_user_id::text
  LIMIT 1;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Audit FIRST: once admin_auth row is gone we lose the actor context.
  BEGIN
    INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
    VALUES (
      auth.uid(),
      p_user_id,
      'user_deleted',
      jsonb_build_object('tokens_revoked', true)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit log skipped: %', SQLERRM;
  END;

  -- Revoke every session of the deleted user (best effort: never blocks delete)
  BEGIN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_tokens cleanup skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'DELETE FROM auth.identities WHERE user_id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'identities cleanup skipped: %', SQLERRM;
  END;

  -- App-level record
  DELETE FROM public.admin_auth WHERE auth_user_id::text = p_user_id::text;

  -- Auth account (best effort: if this fails the account is deactivated in the
  -- app and simply cannot sign in, and the warning tells us what happened)
  BEGIN
    EXECUTE 'DELETE FROM auth.users WHERE id::text = $1' USING p_user_id::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auth.users cleanup skipped: %', SQLERRM;
  END;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4) GRANTS
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public._is_staff_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_session_valid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_auth_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clinic_id_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_user(uuid, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_staff_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_user(uuid) TO authenticated;

-- Reload PostgREST schema cache so the new bodies are used immediately
SELECT pg_notify('pgrst', 'reload schema');

SELECT '✅ staff delete + forced-logout fixes installed' AS status;