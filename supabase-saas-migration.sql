-- ============================================
-- BARBER SHOP SAAS MIGRATION SCRIPT
-- ============================================
-- This script converts the single-tenant system to multi-tenant SaaS
-- Version: 1.0
-- Date: 2026-03-19
--
-- WARNING: Review before applying to production!
-- ============================================

-- ============================================
-- PHASE 1: CREATE NEW CORE TABLES
-- ============================================

-- SHOPS TABLE (Each barbershop is one row)
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL UNIQUE,
  -- Note: Password stored via Supabase Auth, not here
  subscription_status VARCHAR(20) DEFAULT 'active' NOT NULL,
  -- Values: active, inactive, suspended
  subscription_end_date TIMESTAMP,
  plan_id UUID,
  -- FOREIGN KEY will be added after plans table creation
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ADMIN USERS TABLE (Super admins)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  -- Password stored via Supabase Auth
  is_super_admin BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRICING PLANS TABLE (Admin-controlled)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pricing_type VARCHAR(50) NOT NULL,
  -- Values: per_transaction, per_service, quota
  price_per_unit DECIMAL(10, 2),
  -- Used for per_transaction and per_service plans
  quota_limit INTEGER,
  -- Used for quota plans (e.g., 100 transactions)
  monthly_price DECIMAL(10, 2),
  -- Used for quota plans (e.g., $99/month)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USAGE LOGS TABLE (Track billable actions per shop)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  -- Values: transaction, service, haircut
  quantity INTEGER DEFAULT 1,
  billable_amount DECIMAL(10, 2),
  -- Calculated amount for this action
  reference_id UUID,
  -- Can link to transactions.id or bookings.id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  year_month VARCHAR(7)
  -- Format: YYYY-MM for grouping
);

-- BILLING RECORDS TABLE (Monthly summaries - MVP: calculated on demand)
CREATE TABLE IF NOT EXISTS billing_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL,
  total_usage INTEGER,
  total_amount_due DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'draft',
  -- Values: draft, issued, paid
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shop_id, billing_year, billing_month)
);

-- ============================================
-- PHASE 2: ADD shop_id TO EXISTING TABLES
-- ============================================

-- Add shop_id to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

-- Add shop_id to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

-- Add shop_id to barbers table
ALTER TABLE barbers
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

-- Add shop_id to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

-- Add shop_id to expenses table
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE;

-- ============================================
-- PHASE 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Shops
CREATE INDEX IF NOT EXISTS idx_shops_owner_email ON shops(owner_email);
CREATE INDEX IF NOT EXISTS idx_shops_subscription_status ON shops(subscription_status);

-- Multi-tenancy indexes
CREATE INDEX IF NOT EXISTS idx_clients_shop_id ON clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_services_shop_id ON services(shop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_shop_id ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON expenses(shop_id);

-- Usage logs
CREATE INDEX IF NOT EXISTS idx_usage_logs_shop_id ON usage_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_year_month ON usage_logs(year_month);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Billing records
CREATE INDEX IF NOT EXISTS idx_billing_records_shop_id ON billing_records(shop_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_month ON billing_records(billing_year, billing_month);

-- ============================================
-- PHASE 4: ADD FOREIGN KEY CONSTRAINT (Plans)
-- ============================================

ALTER TABLE shops
ADD CONSTRAINT fk_shops_plan_id
FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;

-- ============================================
-- PHASE 5: INSERT DEFAULT DATA
-- ============================================

-- INSERT DEFAULT PLANS
INSERT INTO plans (name, description, pricing_type, price_per_unit, quota_limit, monthly_price, is_active)
VALUES
  (
    'Pay Per Transaction',
    'Charge a fixed amount per booking',
    'per_transaction',
    5.00,
    NULL,
    NULL,
    TRUE
  ),
  (
    'Pay Per Service',
    'Charge per service type (haircut, beard, etc.)',
    'per_service',
    NULL,
    NULL,
    NULL,
    TRUE
  ),
  (
    'Quota Plan',
    'Fixed monthly price for limited transactions',
    'quota',
    NULL,
    100,
    99.00,
    TRUE
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- PHASE 6: CREATE DEFAULT SHOP & ADMIN
-- ============================================

-- Generate a UUID for the default shop (use this later)
-- Default shop_id: will be generated on insert
INSERT INTO shops (name, owner_email, subscription_status, subscription_end_date, plan_id, created_at, updated_at)
SELECT
  'Default Shop',
  'yaa2003ya@gmail.com',
  'active',
  '2099-12-31'::TIMESTAMP,
  (SELECT id FROM plans WHERE pricing_type = 'per_transaction' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE owner_email = 'yaa2003ya@gmail.com')
RETURNING id;

-- Create admin user
INSERT INTO admin_users (email, is_super_admin)
SELECT 'yaa2003ya@gmail.com', TRUE
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'yaa2003ya@gmail.com')
RETURNING id;

-- ============================================
-- PHASE 7: MIGRATE EXISTING DATA TO DEFAULT SHOP
-- ============================================

-- Get the default shop_id
-- Note: In actual execution, you may need to do this in steps
UPDATE clients
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

UPDATE services
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

UPDATE barbers
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

UPDATE transactions
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

UPDATE expenses
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

-- ============================================
-- PHASE 8: DISABLE OLD RLS POLICIES & ENABLE NEW ONES
-- ============================================

-- Drop old policies (they allow all public access)
DROP POLICY IF EXISTS "Enable read access for all users" ON clients;
DROP POLICY IF EXISTS "Enable insert access for all users" ON clients;
DROP POLICY IF EXISTS "Enable update access for all users" ON clients;
DROP POLICY IF EXISTS "Enable delete access for all users" ON clients;

DROP POLICY IF EXISTS "Enable read access for all users" ON services;
DROP POLICY IF EXISTS "Enable insert access for all users" ON services;
DROP POLICY IF EXISTS "Enable update access for all users" ON services;
DROP POLICY IF EXISTS "Enable delete access for all users" ON services;

DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable update access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable delete access for all users" ON transactions;

DROP POLICY IF EXISTS "Enable read access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable insert access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable update access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable delete access for all users" ON expenses;

DROP POLICY IF EXISTS "Enable read access for all users" ON barbers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON barbers;
DROP POLICY IF EXISTS "Enable update access for all users" ON barbers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON barbers;

-- ============================================
-- PHASE 9: CREATE NEW MULTI-TENANT RLS POLICIES
-- ============================================

-- CLIENTS RLS POLICIES
-- Shops can only see their own clients
CREATE POLICY "shops_can_read_own_clients" ON clients
  FOR SELECT
  USING (
    auth.jwt() ->> 'shop_id' = shop_id::TEXT OR
    EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email())
  );

CREATE POLICY "shops_can_insert_own_clients" ON clients
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_update_own_clients" ON clients
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_delete_own_clients" ON clients
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

-- SERVICES RLS POLICIES
CREATE POLICY "shops_can_read_own_services" ON services
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1) OR
    EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email())
  );

CREATE POLICY "shops_can_insert_own_services" ON services
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_update_own_services" ON services
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_delete_own_services" ON services
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

-- BARBERS RLS POLICIES
CREATE POLICY "shops_can_read_own_barbers" ON barbers
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1) OR
    EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email())
  );

CREATE POLICY "shops_can_insert_own_barbers" ON barbers
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_update_own_barbers" ON barbers
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_delete_own_barbers" ON barbers
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

-- TRANSACTIONS RLS POLICIES
CREATE POLICY "shops_can_read_own_transactions" ON transactions
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1) OR
    EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email())
  );

CREATE POLICY "shops_can_insert_own_transactions" ON transactions
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_update_own_transactions" ON transactions
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_delete_own_transactions" ON transactions
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

-- EXPENSES RLS POLICIES
CREATE POLICY "shops_can_read_own_expenses" ON expenses
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1) OR
    EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email())
  );

CREATE POLICY "shops_can_insert_own_expenses" ON expenses
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_update_own_expenses" ON expenses
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

CREATE POLICY "shops_can_delete_own_expenses" ON expenses
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE owner_email = auth.email() LIMIT 1)
  );

-- ============================================
-- PHASE 10: ADMIN-ONLY TABLE RLS POLICIES
-- ============================================

-- SHOPS RLS (Admin only)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_read_all_shops" ON shops
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

CREATE POLICY "admin_can_insert_shops" ON shops
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

CREATE POLICY "admin_can_update_shops" ON shops
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

CREATE POLICY "admin_can_delete_shops" ON shops
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

-- PLANS RLS (Admin only)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_manage_plans" ON plans
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

-- USAGE LOGS RLS (Admin only)
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_read_all_usage_logs" ON usage_logs
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

CREATE POLICY "admin_can_insert_usage_logs" ON usage_logs
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

-- BILLING RECORDS RLS (Admin only)
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_manage_billing_records" ON billing_records
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

-- ADMIN USERS RLS (Admin only)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_manage_admins" ON admin_users
  USING (EXISTS (SELECT 1 FROM admin_users WHERE email = auth.email()));

-- ============================================
-- PHASE 11: MIGRATION VERIFICATION
-- ============================================

-- Verify migration
SELECT
  'Verification Report' as Report,
  CURRENT_TIMESTAMP as ExecutedAt;

SELECT 'Shops Created' as Check, COUNT(*) as Count FROM shops;
SELECT 'Admin Users Created' as Check, COUNT(*) as Count FROM admin_users;
SELECT 'Plans Created' as Check, COUNT(*) as Count FROM plans;
SELECT 'Clients with shop_id' as Check, COUNT(*) as Count FROM clients WHERE shop_id IS NOT NULL;
SELECT 'Services with shop_id' as Check, COUNT(*) as Count FROM services WHERE shop_id IS NOT NULL;
SELECT 'Barbers with shop_id' as Check, COUNT(*) as Count FROM barbers WHERE shop_id IS NOT NULL;
SELECT 'Transactions with shop_id' as Check, COUNT(*) as Count FROM transactions WHERE shop_id IS NOT NULL;
SELECT 'Expenses with shop_id' as Check, COUNT(*) as Count FROM expenses WHERE shop_id IS NOT NULL;

-- ============================================
-- END OF MIGRATION SCRIPT
-- ============================================
