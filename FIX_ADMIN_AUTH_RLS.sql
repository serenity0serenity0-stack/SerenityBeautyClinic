-- ============================================================================
-- FIX ADMIN_AUTH RLS CIRCULAR DEPENDENCY
-- ============================================================================
-- Problem: admin_auth has RLS enabled which creates circular dependency
-- Solution: Disable RLS on admin_auth (authentication table shouldn't have RLS)
-- ============================================================================

-- Step 1: Disable RLS on admin_auth table
ALTER TABLE admin_auth DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies on admin_auth
DROP POLICY IF EXISTS "admin_auth_admin_select" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_admin_insert" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_admin_update" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_admin_delete" ON admin_auth;

-- Step 3: Verify admin_auth has no RLS
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'admin_auth';

-- Step 4: Test access from authenticated user
SELECT id, email, clinic_id, role FROM admin_auth LIMIT 1;

SELECT '✅ ADMIN_AUTH RLS FIX COMPLETE' as status;
