-- ============================================================================
-- FIX: create_staff_user - Remove explicit email from auth.identities INSERT
-- ============================================================================
-- In newer Supabase GoTrue versions, auth.identities.email is a GENERATED
-- column derived from identity_data. Inserting into it causes:
--   ERROR: cannot insert a non-DEFAULT value into column "email"
-- Fix: Remove the email column from the INSERT statement.
-- Run this ONCE in the Supabase SQL editor.
-- ============================================================================

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

  -- Create auth user (confirmed immediately)
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

  -- Create identity row (email is GENERATED from identity_data, do NOT insert it)
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

SELECT '✅ create_staff_user fixed — email column removed from auth.identities INSERT' AS status;
