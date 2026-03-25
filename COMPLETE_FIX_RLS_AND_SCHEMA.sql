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
-- STEP 3: FIX MISSING COLUMNS (already exist, skipping)
-- ============================================================================
-- Note: isActive column in service_variants already exists (PostgreSQL stores as lowercase "isactive")
-- Nothing to do here

-- ============================================================================
-- STEP 4: RENAME OLD shop_id TO clinic_id IF EXISTS
-- ============================================================================

-- Check and rename in each table (only if shop_id exists and clinic_id doesn't)
DO $$ 
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='shop_id') THEN
    ALTER TABLE clients RENAME COLUMN shop_id TO clinic_id;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='barbers' AND column_name='shop_id') THEN
    ALTER TABLE barbers RENAME COLUMN shop_id TO clinic_id;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='shop_id') THEN
    ALTER TABLE services RENAME COLUMN shop_id TO clinic_id;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='service_variants' AND column_name='shop_id') THEN
    ALTER TABLE service_variants RENAME COLUMN shop_id TO clinic_id;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: UPDATE ANY NULL clinic_id VALUES
-- ============================================================================
UPDATE clients SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE barbers SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE services SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE bookings SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE transactions SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE expenses SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE visit_logs SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE subscriptions SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE settings SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE portal_users SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;
UPDATE portal_settings SET clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'::UUID WHERE clinic_id IS NULL;

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
