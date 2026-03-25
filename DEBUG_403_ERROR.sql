-- ============================================================================
-- DEBUG 403 ERROR - CHECK ADMIN_AUTH AND RLS STATUS
-- ============================================================================

-- Step 1: Check if RLS is disabled on admin_auth
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'admin_auth' AND schemaname = 'public';

-- Step 2: Check what's in admin_auth table
SELECT id, email, auth_user_id, clinic_id, role, active 
FROM admin_auth;

-- Step 3: Check if there are any policies on admin_auth
SELECT schemaname, tablename, policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'admin_auth';

-- Step 4: Try a simple select (should work with RLS disabled)
SELECT COUNT(*) as admin_count FROM admin_auth;

-- Step 5: Verify clinic exists
SELECT id, name FROM clinic;

-- Step 6: Check subscriptions
SELECT id, clinic_id, plan, status FROM subscriptions;

SELECT '✅ DEBUG COMPLETE' as status;
