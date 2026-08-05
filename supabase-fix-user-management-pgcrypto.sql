-- ============================================================================
-- FIX: "function gen_salt(unknown) does not exist" when adding a new user
-- ============================================================================
-- Root cause:
--   create_staff_user() and reset_staff_password() call crypt()/gen_salt()
--   from the pgcrypto extension. In Supabase, pgcrypto lives in the
--   "extensions" schema, but the functions were created with
--   SET search_path = public, so gen_salt() was never found.
--
-- Fix: recreate both functions with SET search_path = public, extensions
--      (and make sure pgcrypto is installed).
--
-- Paste this in the Supabase SQL editor and run it once.
-- ============================================================================

-- 1) Make sure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Recreate create_staff_user with extensions in the search path
CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'cashier',
  p_name text DEFAULT NULL,
  p_permissions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
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

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) OR
     EXISTS (SELECT 1 FROM public.admin_auth WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

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

-- 3) Recreate reset_staff_password with extensions in the search path
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

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.admin_auth
  SET password = p_new_password, updated_at = now()
  WHERE auth_user_id = p_user_id;
END;
$$;

-- 4) Re-grant
GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_staff_password(uuid, text) TO authenticated;

-- 5) Verify gen_salt is now reachable with the function's search path
SELECT crypt('test', gen_salt('bf')) IS NOT NULL AS pgcrypto_ok;

SELECT '✅ pgcrypto search_path fix applied' AS status;
