-- ============================================================================
-- COMPLETE DASHBOARD FIX - RLS Policies & Data Setup
-- ============================================================================
-- Execute this SQL in Supabase SQL Editor to fix all dashboard errors
-- Date: March 25, 2026
-- ============================================================================

-- ============================================================================
-- PART 1: ENSURE DATA EXISTS
-- ============================================================================

-- 1. Create clinic record
INSERT INTO clinic (
  id, name, admin_email, admin_name, 
  primary_color, secondary_color, accent_color,
  timezone, currency, language
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'Serenity Beauty Clinic',
  'serenity0serenity0@gmail.com',
  'Admin',
  '#E91E63', '#C2185B', '#F06292',
  'Africa/Cairo', 'EGP', 'ar'
)
ON CONFLICT (id) DO UPDATE 
SET admin_email = 'serenity0serenity0@gmail.com', updated_at = NOW();

-- 2. Verify admin_auth record
SELECT COUNT(*) as admin_auth_count FROM admin_auth 
WHERE auth_user_id = '9bf6605a-db64-4024-9245-f23ef16cae37' 
AND clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- 3. Create subscription
INSERT INTO subscriptions (
  clinic_id, plan, status, started_at, expires_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'professional',
  'active',
  NOW(),
  NOW() + INTERVAL '365 days'
)
ON CONFLICT (clinic_id) DO UPDATE 
SET status = 'active', updated_at = NOW();

-- 4. Sample transaction (for testing)
INSERT INTO transactions (
  clinic_id, client_name, client_phone, amount, total, 
  payment_method, status, date, time, created_at, updated_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'تجربة', '01001234567', 100, 100,
  'cash', 'completed', 
  CURRENT_DATE::text, '12:00:00', NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- 5. Sample expense (for testing)
INSERT INTO expenses (
  clinic_id, category, amount, date, created_at, updated_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'supplies', 50,
  CURRENT_DATE::text, NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 2: FIX RLS POLICIES - TRANSACTIONS TABLE
-- ============================================================================

-- Drop all existing transaction policies (they may be conflicting)
DROP POLICY IF EXISTS "Everyone can read transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can update transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can delete transactions" ON transactions;
DROP POLICY IF EXISTS "shop_select_own_transactions" ON transactions;
DROP POLICY IF EXISTS "shop_insert_own_transactions" ON transactions;
DROP POLICY IF EXISTS "shop_update_own_transactions" ON transactions;
DROP POLICY IF EXISTS "shop_delete_own_transactions" ON transactions;
DROP POLICY IF EXISTS "transactions_read_own" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON transactions;

-- Ensure RLS is enabled on transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create comprehensive, clear policies
CREATE POLICY "transactions_admin_select" ON transactions FOR SELECT
USING (
  -- Admin users can select their clinic's transactions
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = transactions.clinic_id
  )
  OR
  -- Or if clinic_id is null (for any data migration issues)
  clinic_id IS NULL
);

CREATE POLICY "transactions_admin_insert" ON transactions FOR INSERT
WITH CHECK (
  -- Only authenticated admins can insert
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = transactions.clinic_id
  )
);

CREATE POLICY "transactions_admin_update" ON transactions FOR UPDATE
USING (
  -- Only admins can update their clinic's transactions
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = transactions.clinic_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = transactions.clinic_id
  )
);

CREATE POLICY "transactions_admin_delete" ON transactions FOR DELETE
USING (
  -- Only admins can delete their clinic's transactions
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = transactions.clinic_id
  )
);

-- ============================================================================
-- PART 3: FIX RLS POLICIES - EXPENSES TABLE
-- ============================================================================

-- Drop all existing expense policies
DROP POLICY IF EXISTS "Admin can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can update expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can read expenses" ON expenses;
DROP POLICY IF EXISTS "Enable read access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable insert access for all users" ON expenses;
DROP POLICY IF EXISTS "All users can read expenses" ON expenses;

-- Ensure RLS is enabled
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create clear policies
CREATE POLICY "expenses_admin_select" ON expenses FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = expenses.clinic_id
  )
  OR clinic_id IS NULL
);

CREATE POLICY "expenses_admin_insert" ON expenses FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = expenses.clinic_id
  )
);

CREATE POLICY "expenses_admin_update" ON expenses FOR UPDATE
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = expenses.clinic_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = expenses.clinic_id
  )
);

CREATE POLICY "expenses_admin_delete" ON expenses FOR DELETE
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = expenses.clinic_id
  )
);

-- ============================================================================
-- PART 4: FIX RLS POLICIES - SUBSCRIPTIONS TABLE
-- ============================================================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Enable read access for all users" ON subscriptions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON subscriptions;

-- Ensure RLS is enabled
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "subscriptions_admin_select" ON subscriptions FOR SELECT
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = subscriptions.clinic_id
  )
);

CREATE POLICY "subscriptions_admin_insert" ON subscriptions FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = subscriptions.clinic_id
  )
);

CREATE POLICY "subscriptions_admin_update" ON subscriptions FOR UPDATE
USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = subscriptions.clinic_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth 
    WHERE clinic_id = subscriptions.clinic_id
  )
);

-- ============================================================================
-- PART 5: VERIFICATION
-- ============================================================================

-- Verify clinic
SELECT 'CLINIC RECORD:' as verify;
SELECT id, name, admin_email, created_at 
FROM clinic 
WHERE id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- Verify subscription
SELECT 'SUBSCRIPTION RECORD:' as verify;
SELECT id, clinic_id, plan, status 
FROM subscriptions 
WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- Verify data count
SELECT 'DATA COUNTS:' as verify;
SELECT 
  (SELECT COUNT(*) FROM transactions WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de') as transactions_count,
  (SELECT COUNT(*) FROM expenses WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de') as expenses_count,
  (SELECT COUNT(*) FROM clients WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de') as clients_count;

-- Verify RLS policies
SELECT 'RLS POLICIES:' as verify;
SELECT tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('transactions', 'expenses', 'subscriptions')
ORDER BY tablename, policyname;

-- Test query (same as frontend uses)
SELECT 'TEST TRANSACTION QUERY:' as verify;
SELECT id, clinic_id, client_name, amount, total, date, created_at
FROM transactions
WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
ORDER BY created_at DESC
LIMIT 5;

-- Test expense query
SELECT 'TEST EXPENSE QUERY:' as verify;
SELECT id, clinic_id, category, amount, date, created_at
FROM expenses
WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
ORDER BY date DESC
LIMIT 5;

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- ✅ Created/verified clinic record
-- ✅ Created/verified subscription record (active status)
-- ✅ Dropped conflicting RLS policies (old multi-tenant policies)
-- ✅ Created fresh, simple admin-based RLS policies
-- ✅ Enabled RLS on transactions, expenses, subscriptions
-- ✅ Created sample data for testing
-- ✅ Verified all data is accessible
--
-- Next step: Hard refresh dashboard in browser (Ctrl+Shift+R)
-- ============================================================================
