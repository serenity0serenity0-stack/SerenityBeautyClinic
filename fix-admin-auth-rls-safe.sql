-- Fix RLS policies on admin_auth table - safe version

-- Drop all existing policies on admin_auth
DROP POLICY IF EXISTS "authenticated_users_can_read_admin_table" ON admin_auth;
DROP POLICY IF EXISTS "users_can_read_own_admin_record" ON admin_auth;
DROP POLICY IF EXISTS "Enable read access for all users" ON admin_auth;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON admin_auth;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON admin_auth;

-- Ensure RLS is enabled
ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;

-- Create single unified policy for authenticated users
CREATE POLICY "authenticated_users_read_admin_table"
ON admin_auth FOR SELECT
TO authenticated
USING (true);

-- Verify
SELECT * FROM admin_auth;
