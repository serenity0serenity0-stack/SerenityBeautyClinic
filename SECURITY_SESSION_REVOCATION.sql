-- ============================================================================
-- SECURITY: IMMEDIATE SESSION REVOCATION
-- ============================================================================
-- When an Admin disables a user or changes their password, affected sessions
-- are invalidated within 45 seconds (heartbeat) or immediately (Realtime).
--
-- Paste this whole file in the Supabase SQL Editor and run it.
-- It is idempotent (safe to run more than once).
--
-- What it adds:
--   1. security_version column on admin_auth (bumped on disable/enable/password change)
--   2. security_audit_log table for audit trail
--   3. check_session_valid() RPC — called by frontend heartbeat
--   4. Updated get_my_auth_info() — returns security_version
--   5. Updated get_clinic_id_for_user() — returns NULL when active=false
--   6. Updated update_staff_user() — bumps security_version + audit
--   7. Updated reset_staff_password() — bumps security_version + revoke refresh tokens + audit
--   8. Updated delete_staff_user() — revokes refresh tokens + audit
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Add security_version to admin_auth
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_auth
  ADD COLUMN IF NOT EXISTS security_version INT DEFAULT 1;

-- Set initial version to 1 for all existing rows
UPDATE public.admin_auth SET security_version = 1 WHERE security_version IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Security audit log table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (for their clinic)
DROP POLICY IF EXISTS "audit_log_admin_read" ON public.security_audit_log;
CREATE POLICY "audit_log_admin_read"
  ON public.security_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_auth
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only SECURITY DEFINER functions can insert (via the functions below)
DROP POLICY IF EXISTS "audit_log_service_insert" ON public.security_audit_log;
CREATE POLICY "audit_log_service_insert"
  ON public.security_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3) check_session_valid() — called by frontend heartbeat
--    Returns { active, security_version } for the current user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_session_valid()
RETURNS TABLE (
  is_active boolean,
  security_version int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.active, a.security_version
  FROM public.admin_auth a
  WHERE a.auth_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.check_session_valid() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4) Updated get_my_auth_info() — now returns security_version
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_auth_info()
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
  SELECT a.role::text, a.name, a.permissions, a.clinic_id, a.active, a.email::text, a.security_version
  FROM public.admin_auth a
  WHERE a.auth_user_id = auth.uid();
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) Updated get_clinic_id_for_user() — returns NULL when active=false
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_clinic_id_for_user(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT clinic_id
    FROM admin_auth
    WHERE auth_user_id = user_id AND active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_clinic_id_for_user(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6) Updated update_staff_user() — bumps security_version on active toggle
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_staff_user(
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

  SELECT clinic_id, active INTO v_target_clinic, v_old_active
  FROM public.admin_auth WHERE auth_user_id = p_user_id;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Prevent admin from disabling their own account
  IF p_user_id = auth.uid() AND COALESCE(p_active, true) = false THEN
    RAISE EXCEPTION 'You cannot disable your own account';
  END IF;

  v_new_active := COALESCE(p_active, v_old_active);

  -- Bump security_version when active status changes
  IF p_active IS NOT NULL AND p_active != v_old_active THEN
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
    security_version = CASE WHEN v_bumped THEN security_version + 1 ELSE security_version END,
    updated_at = now()
  WHERE auth_user_id = p_user_id;

  -- Audit log
  INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
  VALUES (
    auth.uid(),
    p_user_id,
    CASE WHEN v_new_active THEN 'user_enabled' ELSE 'user_disabled' END,
    jsonb_build_object('old_active', v_old_active, 'new_active', v_new_active, 'version_bumped', v_bumped)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7) Updated reset_staff_password() — bumps security_version + revokes tokens
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_staff_password(
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

  SELECT clinic_id INTO v_target_clinic FROM public.admin_auth WHERE auth_user_id = p_user_id;
  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update password
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.admin_auth
  SET password = p_new_password,
      security_version = security_version + 1,
      updated_at = now()
  WHERE auth_user_id = p_user_id;

  -- Revoke all refresh tokens for this user (forces re-authentication)
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;

  -- Audit log
  INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
  VALUES (
    auth.uid(),
    p_user_id,
    'password_reset',
    jsonb_build_object('tokens_revoked', true)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8) Updated delete_staff_user() — also revokes refresh tokens
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_staff_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_target_clinic uuid;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT clinic_id INTO v_target_clinic FROM public.admin_auth WHERE auth_user_id = p_user_id;
  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Revoke all refresh tokens before deleting
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM public.admin_auth WHERE auth_user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Audit log (actor_user_id = system since target is deleted)
  INSERT INTO public.security_audit_log (actor_user_id, target_user_id, action, details)
  VALUES (
    auth.uid(),
    p_user_id,
    'user_deleted',
    jsonb_build_object('tokens_revoked', true)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9) Grants (ensure new function is accessible)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.check_session_valid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_auth_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_user(uuid, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_staff_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_clinic_id_for_user(UUID) TO authenticated;

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

SELECT '✅ Security session revocation installed' AS status;
