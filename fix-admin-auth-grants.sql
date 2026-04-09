-- Grant proper permissions to anon and authenticated roles
ALTER TABLE admin_auth DISABLE ROW LEVEL SECURITY;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON admin_auth TO authenticated;

-- Grant SELECT permission to anon users (for initial login check)
GRANT SELECT ON admin_auth TO anon;

-- Ensure the table is accessible
ALTER TABLE admin_auth OWNER TO postgres;

-- Verify the admin_auth table
SELECT * FROM admin_auth;
