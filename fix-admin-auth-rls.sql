-- Fix RLS policies on admin_auth table to allow reads

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON admin_auth;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON admin_auth;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON admin_auth;

-- Ensure RLS is enabled
ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to read their own admin record
CREATE POLICY "users_can_read_own_admin_record"
ON admin_auth FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Policy 2: Allow authenticated users to read all admin records (simplified for MVP)
CREATE POLICY "authenticated_users_can_read_admin_table"
ON admin_auth FOR SELECT
TO authenticated
USING (true);

-- Verify the table
SELECT * FROM admin_auth LIMIT 5;
