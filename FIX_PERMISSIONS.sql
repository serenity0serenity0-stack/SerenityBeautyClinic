-- ✅ FIX PERMISSIONS - GRANT ALL ACCESS TO ALL TABLES
-- This script fixes "permission denied" errors by granting complete access

BEGIN;

-- 1. Create necessary roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END
$$;

-- 2. Grant all permissions on all tables to anon and authenticated roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- 3. Grant all permissions on all sequences (for auto-increment IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 4. Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 5. Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- 6. Specific table grants (ensure all tables have full access)
GRANT ALL ON clinic TO anon, authenticated;
GRANT ALL ON admin_auth TO anon, authenticated;
GRANT ALL ON clients TO anon, authenticated;
GRANT ALL ON barbers TO anon, authenticated;
GRANT ALL ON services TO anon, authenticated;
GRANT ALL ON service_variants TO anon, authenticated;
GRANT ALL ON bookings TO anon, authenticated;
GRANT ALL ON visit_logs TO anon, authenticated;
GRANT ALL ON expenses TO anon, authenticated;
GRANT ALL ON transactions TO anon, authenticated;
GRANT ALL ON subscriptions TO anon, authenticated;
GRANT ALL ON settings TO anon, authenticated;
GRANT ALL ON portal_settings TO anon, authenticated;
GRANT ALL ON portal_users TO anon, authenticated;

-- 7. Grant sequence permissions (for auto-increment)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 8. Verify permissions
SELECT 
  table_name,
  string_agg(privilege_type, ', ') as "Granted_Permissions"
FROM information_schema.role_table_grants
WHERE table_schema='public' AND (grantee='anon' OR grantee='authenticated')
GROUP BY table_name
ORDER BY table_name;

COMMIT;

-- ✅ All permissions granted - all tables now fully accessible
