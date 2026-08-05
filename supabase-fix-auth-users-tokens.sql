-- ============================================================================
-- SUPABASE FIX: Auth 500 "Database error querying schema" on manually-created users
-- ============================================================================
-- Root cause: create_staff_user inserted auth.users rows without the token
-- columns. Newer Supabase Auth (GoTrue) requires these to be '' (empty string),
-- NOT NULL. When they are NULL, logging in as that user fails with:
--
--     {"code":"unexpected_failure","message":"Database error querying schema"}
--     (postgres log: error finding user: Scan error on column index 3,
--      name "confirmation_token": converting NULL to string is unsupported)
--
-- The admin user works because GoTrue created that row itself with '' tokens.
--
-- This file:
--   1. Backfills the token columns on existing rows (fixes the users you
--      already created without having to re-create them).
--   2. Replaces create_staff_user so future users are created with '' tokens.
-- Paste the whole file in the Supabase SQL editor and run it (idempotent).

-- ----------------------------------------------------------------------------
-- 1) Backfill existing auth.users rows (safe, only touches NULL token columns)
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET confirmation_token         = '',
    recovery_token             = '',
    email_change_token_new     = '',
    email_change_token_current = '',
    email_change               = '',
    reauthentication_token     = '',
    phone_change_token         = ''
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR email_change IS NULL
   OR reauthentication_token IS NULL
   OR phone_change_token IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Fixed create_staff_user (sets token columns to '')
-- ----------------------------------------------------------------------------
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

  -- Prevent duplicate email
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) OR
     EXISTS (SELECT 1 FROM public.admin_auth WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  -- Create auth user (confirmed immediately, tokens set to '' for GoTrue)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
    email_change, reauthentication_token, phone_change_token,
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
    '', '', '', '',
    '', '', '',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}'::jsonb,
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create identity row (required for password login)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    email, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_email,
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

GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, text, jsonb) TO authenticated;

SELECT '✅ auth token backfill + create_staff_user fixed' AS status;
