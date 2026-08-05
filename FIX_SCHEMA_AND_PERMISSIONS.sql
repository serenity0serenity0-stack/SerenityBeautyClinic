-- ============================================================================
-- COMPREHENSIVE FIX: REPLACE shop_id WITH clinic_id AND DISABLE ALL RLS
-- ============================================================================

-- This script fixes schema issues and permissions for single-clinic Serenity
-- Step 1: Disable RLS on all tables
-- Step 2: Rename all shop_id columns to clinic_id where they exist
-- Step 3: Update NULL clinic_id values to correct clinic UUID

-- ============================================================================
-- STEP 1: DISABLE RLS ON ALL TABLES
-- ============================================================================

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
ALTER TABLE portal_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies
DROP POLICY IF EXISTS "clinic_admin_select" ON clinic;
DROP POLICY IF EXISTS "clinic_admin_insert" ON clinic;
DROP POLICY IF EXISTS "clinic_admin_update" ON clinic;
DROP POLICY IF EXISTS "admin_auth_admin_select" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_admin_insert" ON admin_auth;
DROP POLICY IF EXISTS "admin_auth_admin_update" ON admin_auth;
DROP POLICY IF EXISTS "clients_admin_select" ON clients;
DROP POLICY IF EXISTS "clients_admin_insert" ON clients;
DROP POLICY IF EXISTS "clients_admin_update" ON clients;
DROP POLICY IF EXISTS "barbers_admin_select" ON barbers;
DROP POLICY IF EXISTS "barbers_admin_insert" ON barbers;
DROP POLICY IF EXISTS "barbers_admin_update" ON barbers;
DROP POLICY IF EXISTS "services_admin_select" ON services;
DROP POLICY IF EXISTS "services_admin_insert" ON services;
DROP POLICY IF EXISTS "services_admin_update" ON services;
DROP POLICY IF EXISTS "service_variants_admin_select" ON service_variants;
DROP POLICY IF EXISTS "bookings_admin_select" ON bookings;
DROP POLICY IF EXISTS "bookings_admin_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_admin_update" ON bookings;
DROP POLICY IF EXISTS "transactions_admin_select" ON transactions;
DROP POLICY IF EXISTS "transactions_admin_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_admin_update" ON transactions;
DROP POLICY IF EXISTS "expenses_admin_select" ON expenses;
DROP POLICY IF EXISTS "expenses_admin_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_admin_update" ON expenses;
DROP POLICY IF EXISTS "visit_logs_admin_select" ON visit_logs;
DROP POLICY IF EXISTS "visit_logs_admin_insert" ON visit_logs;
DROP POLICY IF EXISTS "visit_logs_admin_update" ON visit_logs;
DROP POLICY IF EXISTS "subscriptions_admin_select" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_insert" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_update" ON subscriptions;
DROP POLICY IF EXISTS "settings_admin_select" ON settings;
DROP POLICY IF EXISTS "settings_admin_insert" ON settings;
DROP POLICY IF EXISTS "settings_admin_update" ON settings;
DROP POLICY IF EXISTS "portal_settings_admin_select" ON portal_settings;
DROP POLICY IF EXISTS "portal_settings_admin_insert" ON portal_settings;
DROP POLICY IF EXISTS "portal_settings_admin_update" ON portal_settings;
DROP POLICY IF EXISTS "portal_users_admin_select" ON portal_users;
DROP POLICY IF EXISTS "portal_users_admin_insert" ON portal_users;
DROP POLICY IF EXISTS "portal_users_admin_update" ON portal_users;

-- ============================================================================
-- STEP 2: RENAME shop_id TO clinic_id (if column exists)
-- ============================================================================

DO $$
BEGIN
  -- Fix settings table
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='shop_id') THEN
    ALTER TABLE settings RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE settings ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  -- Fix portal_settings table
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='portal_settings' AND column_name='shop_id') THEN
    ALTER TABLE portal_settings RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE portal_settings ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  -- Fix portal_users table - already should be clinic_id, but just in case
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='portal_users' AND column_name='shop_id') THEN
    ALTER TABLE portal_users RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE portal_users ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  -- Fix other tables that might have shop_id
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='shop_id') THEN
    ALTER TABLE clients RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE clients ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='barbers' AND column_name='shop_id') THEN
    ALTER TABLE barbers RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE barbers ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='shop_id') THEN
    ALTER TABLE services RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE services ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='service_variants' AND column_name='shop_id') THEN
    ALTER TABLE service_variants RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE service_variants ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='shop_id') THEN
    ALTER TABLE bookings RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE bookings ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='shop_id') THEN
    ALTER TABLE transactions RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE transactions ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='shop_id') THEN
    ALTER TABLE expenses RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE expenses ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='visit_logs' AND column_name='shop_id') THEN
    ALTER TABLE visit_logs RENAME COLUMN shop_id TO clinic_id;
    ALTER TABLE visit_logs ALTER COLUMN clinic_id SET NOT NULL;
  END IF;
  
END $$;

-- ============================================================================
-- STEP 3: UPDATE NULL clinic_id VALUES
-- ============================================================================

-- The clinic UUID for Serenity Beauty Clinic
UPDATE settings SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE portal_settings SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE portal_users SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE clients SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE barbers SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE services SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE service_variants SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE bookings SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE transactions SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE expenses SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE visit_logs SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

SELECT 'SETTINGS' AS table_name, COUNT(*) AS row_count, COUNT(DISTINCT clinic_id) AS unique_clinics FROM settings
UNION ALL
SELECT 'PORTAL_SETTINGS', COUNT(*), COUNT(DISTINCT clinic_id) FROM portal_settings
UNION ALL
SELECT 'PORTAL_USERS', COUNT(*), COUNT(DISTINCT clinic_id) FROM portal_users
UNION ALL
SELECT 'CLIENTS', COUNT(*), COUNT(DISTINCT clinic_id) FROM clients
UNION ALL
SELECT 'BARBERS', COUNT(*), COUNT(DISTINCT clinic_id) FROM barbers
UNION ALL
SELECT 'SERVICES', COUNT(*), COUNT(DISTINCT clinic_id) FROM services
UNION ALL
SELECT 'BOOKINGS', COUNT(*), COUNT(DISTINCT clinic_id) FROM bookings
UNION ALL
SELECT 'TRANSACTIONS', COUNT(*), COUNT(DISTINCT clinic_id) FROM transactions
UNION ALL
SELECT 'EXPENSES', COUNT(*), COUNT(DISTINCT clinic_id) FROM expenses
UNION ALL
SELECT 'VISIT_LOGS', COUNT(*), COUNT(DISTINCT clinic_id) FROM visit_logs;
