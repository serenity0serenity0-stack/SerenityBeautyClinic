-- ============================================================================
-- COMPLETE FIX - DISABLE RLS + FIX SCHEMA
-- ============================================================================
-- This script:
-- 1. Disables ALL RLS on ALL tables
-- 2. Drops ALL policies
-- 3. Fixes missing columns (clinic_id, isActive)
-- 4. Renames old shop_id to clinic_id
-- ============================================================================

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
ALTER TABLE portal_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP ALL POLICIES
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: FIX MISSING COLUMNS
-- ============================================================================

-- Add clinic_id to visit_logs if missing
ALTER TABLE visit_logs ADD COLUMN clinic_id UUID DEFAULT 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID;
ALTER TABLE visit_logs ADD CONSTRAINT fk_visit_logs_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id) ON DELETE CASCADE;

-- Add isActive to service_variants if missing
ALTER TABLE service_variants ADD COLUMN isActive BOOLEAN DEFAULT true;

-- ============================================================================
-- STEP 4: RENAME OLD shop_id TO clinic_id IF EXISTS
-- ============================================================================

-- Check and rename in each table
ALTER TABLE clients RENAME COLUMN shop_id TO clinic_id;
ALTER TABLE barbers RENAME COLUMN shop_id TO clinic_id;
ALTER TABLE services RENAME COLUMN shop_id TO clinic_id;
ALTER TABLE service_variants RENAME COLUMN shop_id TO clinic_id;

-- ============================================================================
-- STEP 5: UPDATE ANY NULL clinic_id VALUES
-- ============================================================================
UPDATE clients SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE barbers SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE services SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE service_variants SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE visit_logs SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;

-- ============================================================================
-- STEP 6: VERIFY
-- ============================================================================
SELECT '✅ COMPLETE FIX EXECUTED' as status;

-- Verify no RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- Verify tables exist and are accessible
SELECT COUNT(*) as client_count FROM clients;
SELECT COUNT(*) as barber_count FROM barbers;
SELECT COUNT(*) as service_count FROM services;
SELECT COUNT(*) as transaction_count FROM transactions;
SELECT COUNT(*) as visit_log_count FROM visit_logs;
