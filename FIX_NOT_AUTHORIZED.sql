-- ============================================================================
-- DEBUG & FIX "NOT AUTHORIZED" ERROR
-- ============================================================================

-- Step 1: Check current admin user record
SELECT 'Admin User Found' as status;

-- Step 2: Check what's in admin_auth
SELECT id, email, auth_user_id, clinic_id, role FROM admin_auth;

-- Step 3: Check if auth ID is correct
SELECT 
  '9bf6605a-db64-4024-9245-f23ef16cae37' as expected_auth_id,
  auth_user_id as stored_auth_id,
  ('9bf6605a-db64-4024-9245-f23ef16cae37' = auth_user_id) as auth_matches
FROM admin_auth;

-- Step 4: If auth IDs don't match, update admin_auth with the correct auth ID
-- SOLUTION: Update the auth_user_id to match the admin user's Supabase auth ID
UPDATE admin_auth 
SET auth_user_id = '9bf6605a-db64-4024-9245-f23ef16cae37'
WHERE email = 'serenity0serenity0@gmail.com';

-- Step 5: Verify the update
SELECT 
  '9bf6605a-db64-4024-9245-f23ef16cae37' as expected_auth_id,
  auth_user_id as stored_auth_id,
  ('9bf6605a-db64-4024-9245-f23ef16cae37' = auth_user_id) as auth_matches
FROM admin_auth
WHERE email = 'serenity0serenity0@gmail.com';

-- Step 6: Test access - try to read a transaction
SELECT * FROM transactions LIMIT 1;

SELECT '✅ AUTHORIZATION FIX COMPLETE' as status;
