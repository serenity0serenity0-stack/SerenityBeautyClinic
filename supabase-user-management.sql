-- ============================================================================
-- SUPABASE: STAFF USER MANAGEMENT (Admin + Cashier roles with page permissions)
-- ============================================================================
-- Paste this whole file in the Supabase SQL editor and run it.
-- It is idempotent (safe to run more than once).
--
-- What it adds:
--   1. New columns on admin_auth: name, permissions (jsonb), password (plain
--      text copy for admin viewing).
--   2. RLS on admin_auth (users can only read their own row directly; all
--      management goes through the SECURITY DEFINER functions below).
--   3. RPC functions:
--        get_my_auth_info()          -> current user's role/permissions/name
--        get_staff_users()           -> list staff of my clinic (admins only, includes passwords)
--        create_staff_user(...)      -> create auth user + identity + admin_auth row (admins only)
--        update_staff_user(...)      -> change role/name/permissions/active   (admins only)
--        reset_staff_password(...)   -> reset password in auth + plain copy   (admins only)
--        delete_staff_user(...)      -> remove auth user + admin_auth row     (admins only)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Extend admin_auth table
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.admin_auth
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS password text;

COMMENT ON COLUMN public.admin_auth.password IS
  'Plain-text password copy so the admin can view/reset it. Only visible through the admin-only get_staff_users() function.';

-- ----------------------------------------------------------------------------
-- 2) Secure admin_auth with RLS (management happens only via RPC functions)
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_auth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_auth_read_own" ON public.admin_auth;
CREATE POLICY "admin_auth_read_own"
  ON public.admin_auth
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3) Helper: get current user's own auth info
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
  SELECT a.role::text, a.name, a.permissions, a.clinic_id, a.active, a.email::text
  FROM public.admin_auth a
  WHERE a.auth_user_id = auth.uid();
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) Admin guard helper (internal)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_staff_admin()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  SELECT clinic_id INTO v_clinic_id
  FROM public.admin_auth
  WHERE auth_user_id = auth.uid() AND role = 'admin';
  RETURN v_clinic_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) List all staff users of my clinic (admins only, includes password copy)
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
  SELECT a.id, a.email::text, a.name, a.role::text, a.active, a.permissions, a.password, a.auth_user_id, a.created_at
  FROM public.admin_auth a
  WHERE a.clinic_id = v_clinic_id
  ORDER BY a.role = 'admin' DESC, a.created_at ASC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) Create staff user (admins only)
--    Creates the Supabase auth user (already confirmed, no email needed),
--    its identity row, and the admin_auth record.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'cashier',
  p_name text DEFAULT NULL,
  p_permissions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid := public._is_staff_admin();
  v_user_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF p_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Prevent duplicate email
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) OR
     EXISTS (SELECT 1 FROM public.admin_auth WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  -- Create auth user (confirmed immediately)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}'::jsonb,
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create identity row (required for password login)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- Create admin_auth record
  INSERT INTO public.admin_auth (
    email, auth_user_id, clinic_id, role, active, name, permissions, password
  )
  VALUES (
    v_email, v_user_id, v_clinic_id, p_role, true, p_name,
    CASE WHEN p_role = 'admin' THEN '["all"]'::jsonb ELSE COALESCE(p_permissions, '[]'::jsonb) END,
    p_password
  );

  RETURN jsonb_build_object('id', v_user_id, 'email', v_email);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7) Update staff user (admins only) - role / name / permissions / active
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
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;

  SELECT clinic_id INTO v_target_clinic FROM public.admin_auth WHERE auth_user_id = p_user_id;
  IF v_target_clinic IS NULL OR v_target_clinic <> v_clinic_id THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Prevent admin from disabling/deleting their own account (lockout protection)
  IF p_user_id = auth.uid() AND COALESCE(p_active, true) = false THEN
    RAISE EXCEPTION 'You cannot disable your own account';
  END IF;

  UPDATE public.admin_auth SET
    role = COALESCE(p_role, role),
    name = COALESCE(p_name, name),
    permissions = CASE
      WHEN p_role = 'admin' THEN '["all"]'::jsonb
      ELSE COALESCE(p_permissions, permissions)
    END,
    active = COALESCE(p_active, active),
    updated_at = now()
  WHERE auth_user_id = p_user_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8) Reset staff password (admins only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_staff_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.admin_auth
  SET password = p_new_password, updated_at = now()
  WHERE auth_user_id = p_user_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9) Delete staff user (admins only)
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

  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM public.admin_auth WHERE auth_user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10) Grants
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_my_auth_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_user(uuid, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_staff_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_user(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11) Make the existing clinic owner admin record explicit
--     (run after creating the table. Adjust the email if needed)
-- ----------------------------------------------------------------------------
UPDATE public.admin_auth
SET permissions = '["all"]'::jsonb
WHERE role = 'admin' AND (permissions IS NULL OR permissions = '[]'::jsonb);

SELECT '✅ Staff user management installed' AS status;
