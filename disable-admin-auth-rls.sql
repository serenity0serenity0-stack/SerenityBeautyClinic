-- Disable RLS on admin_auth table completely
ALTER TABLE admin_auth DISABLE ROW LEVEL SECURITY;

-- Verify admin_auth data
SELECT * FROM admin_auth;
