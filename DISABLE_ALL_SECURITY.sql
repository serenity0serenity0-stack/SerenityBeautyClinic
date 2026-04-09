-- ⚠️ DISABLE ALL ROW-LEVEL SECURITY - PUBLIC READ ACCESS
-- This script disables all RLS policies and enables public read access on all tables
-- WARNING: This removes all data protection - use only for development/testing!

BEGIN;

-- 1. Disable RLS on all tables
ALTER TABLE IF EXISTS clinic DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_auth DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS barbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS visit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS portal_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS portal_users DISABLE ROW LEVEL SECURITY;

-- 2. Set all tables to public read access using Anon role
-- Create anon role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
END
$$;

-- Grant SELECT on all tables to anon (public read)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE ON TABLES TO anon;

-- 4. Drop all existing RLS policies
DROP POLICY IF EXISTS "clinic_isolation" ON clinic;
DROP POLICY IF EXISTS "clinic_insert" ON clinic;
DROP POLICY IF EXISTS "clinic_update" ON clinic;
DROP POLICY IF EXISTS "clinic_delete" ON clinic;

DROP POLICY IF EXISTS "admin_auth_isolation" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_insert" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_update" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_delete" ON admin_auth;

DROP POLICY IF EXISTS "clients_clinic_isolation" ON clients;
DROP POLICY IF EXISTS "clients_clinic_insert" ON clients;
DROP POLICY IF EXISTS "clients_clinic_update" ON clients;
DROP POLICY IF EXISTS "clients_clinic_delete" ON clients;

DROP POLICY IF EXISTS "barbers_clinic_isolation" ON barbers;
DROP POLICY IF EXISTS "barbers_clinic_insert" ON barbers;
DROP POLICY IF EXISTS "barbers_clinic_update" ON barbers;
DROP POLICY IF EXISTS "barbers_clinic_delete" ON barbers;

DROP POLICY IF EXISTS "services_clinic_isolation" ON services;
DROP POLICY IF EXISTS "services_clinic_insert" ON services;
DROP POLICY IF EXISTS "services_clinic_update" ON services;
DROP POLICY IF EXISTS "services_clinic_delete" ON services;

DROP POLICY IF EXISTS "service_variants_clinic_isolation" ON service_variants;
DROP POLICY IF EXISTS "service_variants_clinic_insert" ON service_variants;
DROP POLICY IF EXISTS "service_variants_clinic_update" ON service_variants;
DROP POLICY IF EXISTS "service_variants_clinic_delete" ON service_variants;

DROP POLICY IF EXISTS "bookings_clinic_isolation" ON bookings;
DROP POLICY IF EXISTS "bookings_clinic_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_clinic_update" ON bookings;
DROP POLICY IF EXISTS "bookings_clinic_delete" ON bookings;

DROP POLICY IF EXISTS "visit_logs_clinic_isolation" ON visit_logs;
DROP POLICY IF EXISTS "visit_logs_clinic_insert" ON visit_logs;
DROP POLICY IF EXISTS "visit_logs_clinic_update" ON visit_logs;
DROP POLICY IF EXISTS "visit_logs_clinic_delete" ON visit_logs;

DROP POLICY IF EXISTS "expenses_clinic_isolation" ON expenses;
DROP POLICY IF EXISTS "expenses_clinic_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_clinic_update" ON expenses;
DROP POLICY IF EXISTS "expenses_clinic_delete" ON expenses;

DROP POLICY IF EXISTS "transactions_clinic_isolation" ON transactions;
DROP POLICY IF EXISTS "transactions_clinic_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_clinic_update" ON transactions;
DROP POLICY IF EXISTS "transactions_clinic_delete" ON transactions;

DROP POLICY IF EXISTS "subscriptions_clinic_isolation" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_clinic_insert" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_clinic_update" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_clinic_delete" ON subscriptions;

DROP POLICY IF EXISTS "settings_clinic_isolation" ON settings;
DROP POLICY IF EXISTS "settings_clinic_insert" ON settings;
DROP POLICY IF EXISTS "settings_clinic_update" ON settings;
DROP POLICY IF EXISTS "settings_clinic_delete" ON settings;

DROP POLICY IF EXISTS "portal_settings_isolation" ON portal_settings;
DROP POLICY IF EXISTS "portal_settings_insert" ON portal_settings;
DROP POLICY IF EXISTS "portal_settings_update" ON portal_settings;
DROP POLICY IF EXISTS "portal_settings_delete" ON portal_settings;

DROP POLICY IF EXISTS "portal_users_isolation" ON portal_users;
DROP POLICY IF EXISTS "portal_users_insert" ON portal_users;
DROP POLICY IF EXISTS "portal_users_update" ON portal_users;
DROP POLICY IF EXISTS "portal_users_delete" ON portal_users;

-- 5. Verify status
SELECT 
  t.tablename as "Table_Name",
  t.rowsecurity as "RLS_Status"
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;

COMMIT;

-- ✅ All RLS disabled - all tables now public readable and writable
