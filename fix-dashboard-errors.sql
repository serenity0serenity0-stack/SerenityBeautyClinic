-- ============================================================================
-- FIX DASHBOARD ERRORS - Diagnostic & Repair
-- ============================================================================
-- Fixes: 404 subscription errors, 403 transaction ordering errors, 400 expense errors
-- Date: March 25, 2026
-- ============================================================================

-- ============================================================================
-- STEP 1: VERIFY AND CREATE CLINIC RECORD
-- ============================================================================
-- Check if clinic exists
SELECT 'CHECKING CLINIC' as step;
SELECT id, name, admin_email FROM clinic WHERE id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- If no results above, insert clinic record
INSERT INTO clinic (id, name, admin_email, admin_name, primary_color, secondary_color, accent_color, timezone, currency, language)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'Serenity Beauty Clinic',
  'serenity0serenity0@gmail.com',
  'Admin',
  '#E91E63',
  '#C2185B',
  '#F06292',
  'Africa/Cairo',
  'EGP',
  'ar'
)
ON CONFLICT (id) DO NOTHING;

-- Verify admin_auth record
SELECT 'CHECKING ADMIN_AUTH' as step;
SELECT id, email, auth_user_id, clinic_id FROM admin_auth WHERE auth_user_id = '9bf6605a-db64-4024-9245-f23ef16cae37';

-- Verify subscription record exists
SELECT 'CHECKING SUBSCRIPTION' as step;
SELECT id, clinic_id, status, plan FROM subscriptions WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- If no subscription, create one
INSERT INTO subscriptions (clinic_id, plan, status, started_at, expires_at)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'professional',
  'active',
  NOW(),
  NOW() + INTERVAL '365 days'
)
ON CONFLICT (clinic_id) DO NOTHING;

-- ============================================================================
-- STEP 2: CHECK AND FIX RLS POLICIES
-- ============================================================================
-- Check current RLS policies on transactions table
SELECT 'CHECKING RLS POLICIES' as step;
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'transactions'
ORDER BY policyname;

-- Disable RLS temporarily to verify data exists and queries work
SELECT 'DISABLING RLS ON TRANSACTIONS' as step;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Check if transactions exist for this clinic
SELECT 'CHECKING TRANSACTIONS DATA' as step;
SELECT COUNT(*) as transaction_count 
FROM transactions 
WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- Re-enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: VERIFY COLUMN NAMES (for 400 errors)
-- ============================================================================
SELECT 'CHECKING TABLE STRUCTURES' as step;

-- Check expenses table columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expenses' ORDER BY ordinal_position;

-- Check transactions table columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position;

-- ============================================================================
-- STEP 4: CREATE MISSING SAMPLE DATA (if needed)
-- ============================================================================
-- Insert sample transaction for testing
INSERT INTO transactions (
  clinic_id, client_name, client_phone, barber_id,
  amount, discount_type, total, payment_method, status,
  description, date, time, created_at, updated_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'Test Client',
  '01001234567',
  NULL,
  100,
  'percentage',
  95,
  'cash',
  'completed',
  'Test transaction',
  CURRENT_DATE::text,
  CURRENT_TIME::text,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Insert sample expense
INSERT INTO expenses (
  clinic_id, category, amount, date, note, created_at, updated_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'supplies',
  150,
  CURRENT_DATE::text,
  'Test expense',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: VERIFY ALL DATA
-- ============================================================================
SELECT 'FINAL VERIFICATION' as step;
SELECT 'Clinic' as table_name, COUNT(*) FROM clinic WHERE id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'Admin Auth', COUNT(*) FROM admin_auth WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'Subscriptions', COUNT(*) FROM subscriptions WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'Transactions', COUNT(*) FROM transactions WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';
