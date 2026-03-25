-- ============================================================================
-- DISABLE ALL RLS - REMOVE ALL POLICIES AND RLS
-- ============================================================================
-- Temporarily disable all Row Level Security for testing
-- This removes all security policies - use only for development
-- ============================================================================

-- Step 1: Disable RLS on all tables
ALTER TABLE clinic DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_auth DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all RLS policies
DROP POLICY IF EXISTS "transactions_admin_select" ON transactions;
DROP POLICY IF EXISTS "transactions_admin_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_admin_update" ON transactions;
DROP POLICY IF EXISTS "transactions_admin_delete" ON transactions;

DROP POLICY IF EXISTS "expenses_admin_select" ON expenses;
DROP POLICY IF EXISTS "expenses_admin_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_admin_update" ON expenses;
DROP POLICY IF EXISTS "expenses_admin_delete" ON expenses;

DROP POLICY IF EXISTS "clients_admin_select" ON clients;
DROP POLICY IF EXISTS "clients_admin_insert" ON clients;
DROP POLICY IF EXISTS "clients_admin_update" ON clients;

DROP POLICY IF EXISTS "barbers_admin_select" ON barbers;
DROP POLICY IF EXISTS "barbers_admin_insert" ON barbers;
DROP POLICY IF EXISTS "barbers_admin_update" ON barbers;

DROP POLICY IF EXISTS "services_admin_select" ON services;
DROP POLICY IF EXISTS "services_admin_insert" ON services;
DROP POLICY IF EXISTS "services_admin_update" ON services;

DROP POLICY IF EXISTS "bookings_admin_select" ON bookings;
DROP POLICY IF EXISTS "bookings_admin_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_admin_update" ON bookings;

DROP POLICY IF EXISTS "visit_logs_admin_select" ON visit_logs;
DROP POLICY IF EXISTS "visit_logs_admin_insert" ON visit_logs;

DROP POLICY IF EXISTS "subscriptions_admin_select" ON subscriptions;

DROP POLICY IF EXISTS "service_variants_admin_select" ON service_variants;
DROP POLICY IF EXISTS "service_variants_admin_insert" ON service_variants;

DROP POLICY IF EXISTS "settings_admin_select" ON settings;
DROP POLICY IF EXISTS "settings_admin_insert" ON settings;
DROP POLICY IF EXISTS "settings_admin_update" ON settings;

-- Step 3: Verify all RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE table_schema = 'public' 
ORDER BY tablename;

SELECT '✅ ALL RLS DISABLED' as status;
