-- ============================================
-- BARBER SHOP MULTI-TENANT SAAS MIGRATION
-- FINAL PRODUCTION-READY VERSION
-- ============================================
-- Date: 2026-03-19
-- Auth: Shop-level login + Admin via Supabase Auth
-- Billing: Dynamic calculation (no stored records)
--
-- ⚠️ CRITICAL: Apply in order, verify each phase
-- ============================================

-- ============================================
-- PREREQUISITE: CREATE EXTENSION
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PHASE 1: CREATE NEW CORE TABLES
-- ============================================

-- 1.1 SHOPS TABLE
-- Each barbershop is one row with a linked Supabase Auth user
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL UNIQUE,
  auth_user_id UUID UNIQUE,
  -- Links to auth.users(id) - set when shop is created
  -- IMPORTANT: Not a foreign key to allow creation before auth user exists
  
  subscription_status VARCHAR(20) DEFAULT 'active',
  -- Values: active, inactive, suspended
  subscription_end_date TIMESTAMP,
  
  plan_id UUID,
  -- Will reference plans table after creation
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 ADMIN USERS TABLE
-- Super admins with full system access
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  auth_user_id UUID UNIQUE,
  -- Links to auth.users(id) - set when admin is created
  
  is_super_admin BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.3 PRICING PLANS TABLE
-- Admin-controlled, cannot be changed by shops
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  pricing_type VARCHAR(50) NOT NULL,
  -- Values: per_transaction, per_service, quota
  
  price_per_unit DECIMAL(10, 2),
  -- For per_transaction: charge per booking
  -- For per_service: charge per service item in booking
  -- For quota: NULL (uses monthly_price instead)
  
  quota_limit INTEGER,
  -- For quota plans only (e.g., 100 transactions/month)
  -- NULL for per_transaction and per_service
  
  monthly_price DECIMAL(10, 2),
  -- For quota plans only
  -- NULL for per_transaction and per_service
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.4 USAGE LOGS TABLE
-- Track all billable actions per shop
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  shop_id UUID NOT NULL,
  -- References shops(id) - will add constraint later
  
  action_type VARCHAR(50) NOT NULL,
  -- Values: transaction, service
  -- transaction: one full booking/order
  -- service: individual service item within transaction
  
  quantity INTEGER DEFAULT 1,
  -- Number of units (for per_service: services count, for per_transaction: always 1)
  
  billable_amount DECIMAL(10, 2),
  -- Calculated amount = price_per_unit * quantity
  
  reference_id UUID,
  -- Can link to transactions.id for traceability
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  year_month VARCHAR(7)
  -- Format: YYYY-MM for easy monthly grouping in queries
);

-- ============================================
-- PHASE 2: ADD shop_id TO EXISTING TABLES (SAFE WAY)
-- ============================================

-- 2.1 Add shop_id to clients (nullable first)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS shop_id UUID;

-- 2.2 Add shop_id to services (nullable first)
ALTER TABLE services
ADD COLUMN IF NOT EXISTS shop_id UUID;

-- 2.3 Add shop_id to barbers (nullable first)
ALTER TABLE barbers
ADD COLUMN IF NOT EXISTS shop_id UUID;

-- 2.4 Add shop_id to transactions (nullable first)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS shop_id UUID;

-- 2.5 Add shop_id to expenses (nullable first)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS shop_id UUID;

-- ============================================
-- PHASE 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Shops indexes
CREATE INDEX IF NOT EXISTS idx_shops_owner_email ON shops(owner_email);
CREATE INDEX IF NOT EXISTS idx_shops_auth_user_id ON shops(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_shops_subscription_status ON shops(subscription_status);

-- Admin indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_user_id ON admin_users(auth_user_id);

-- Multi-tenancy indexes (for RLS)
CREATE INDEX IF NOT EXISTS idx_clients_shop_id ON clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_services_shop_id ON services(shop_id);
CREATE INDEX IF NOT EXISTS idx_barbers_shop_id ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON expenses(shop_id);

-- Usage logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_shop_id ON usage_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_year_month ON usage_logs(year_month);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- ============================================
-- PHASE 4: ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Add foreign key for plans
ALTER TABLE shops
ADD CONSTRAINT fk_shops_plan_id
FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;

-- Add foreign keys for multi-tenancy columns
ALTER TABLE clients
ADD CONSTRAINT fk_clients_shop_id
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE services
ADD CONSTRAINT fk_services_shop_id
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE barbers
ADD CONSTRAINT fk_barbers_shop_id
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_shop_id
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_shop_id
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE usage_logs
ADD CONSTRAINT fk_usage_logs_shop_id
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- ============================================
-- PHASE 5: DATABASE TRIGGER FUNCTION
-- FOR AUTOMATIC USAGE TRACKING
-- ============================================

-- Function: Log transaction usage when a new transaction is created
-- Pricing logic:
--   Per Transaction: 1 unit per transaction, multiply by price_per_unit
--   Per Service: Count items in transaction, multiply by price_per_unit
--   Quota: Just log (no unit tracking, billing is monthly_price)

CREATE OR REPLACE FUNCTION log_transaction_usage()
RETURNS TRIGGER AS $$
DECLARE
  plan_pricing_type VARCHAR(50);
  price_per_unit DECIMAL(10, 2);
  unit_count INTEGER;
  billable_amount DECIMAL(10, 2);
  year_month VARCHAR(7);
BEGIN
  -- Get shop's plan pricing type
  SELECT pricing_type, price_per_unit
  INTO plan_pricing_type, price_per_unit
  FROM plans
  WHERE id = (
    SELECT plan_id FROM shops WHERE id = NEW.shop_id LIMIT 1
  );

  -- Calculate year_month for grouping
  year_month := TO_CHAR(NEW.date::TIMESTAMP, 'YYYY-MM');

  -- Calculate units based on pricing type
  IF plan_pricing_type = 'per_transaction' THEN
    unit_count := 1;
    billable_amount := price_per_unit * 1;
    
  ELSIF plan_pricing_type = 'per_service' THEN
    -- Count items in transaction (from JSONB items array)
    unit_count := COALESCE(jsonb_array_length(NEW.items), 0);
    billable_amount := price_per_unit * unit_count;
    
  ELSIF plan_pricing_type = 'quota' THEN
    -- For quota, track as 1 unit per transaction
    unit_count := 1;
    billable_amount := 0;  -- Not used in quota billing
  ELSE
    unit_count := 1;
    billable_amount := 0;
  END IF;

  -- Insert into usage_logs
  INSERT INTO usage_logs (
    shop_id,
    action_type,
    quantity,
    billable_amount,
    reference_id,
    year_month,
    created_at
  ) VALUES (
    NEW.shop_id,
    'transaction',
    unit_count,
    billable_amount,
    NEW.id,
    year_month,
    CURRENT_TIMESTAMP
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on transactions insert
DROP TRIGGER IF EXISTS trigger_log_transaction_usage ON transactions;

CREATE TRIGGER trigger_log_transaction_usage
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_usage();

-- ============================================
-- PHASE 6: INSERT DEFAULT DATA
-- ============================================

-- 6.1 Insert default plans
INSERT INTO plans (name, description, pricing_type, price_per_unit, quota_limit, monthly_price, is_active)
VALUES
  (
    'Pay Per Transaction',
    'Charge $X per transaction (booking), regardless of services',
    'per_transaction',
    5.00,
    NULL,
    NULL,
    TRUE
  ),
  (
    'Pay Per Service',
    'Charge $X per service item. If booking has 3 items, charge 3x',
    'per_service',
    8.00,
    NULL,
    NULL,
    TRUE
  ),
  (
    'Quota Plan',
    'Fixed monthly price for up to N transactions',
    'quota',
    NULL,
    100,
    99.00,
    TRUE
  )
ON CONFLICT DO NOTHING;

-- 6.2 Create default shop (without auth_user_id for now)
INSERT INTO shops (name, owner_email, subscription_status, subscription_end_date, plan_id)
SELECT
  'Default Shop',
  'yaa2003ya@gmail.com',
  'active',
  '2099-12-31'::TIMESTAMP,
  (SELECT id FROM plans WHERE pricing_type = 'per_transaction' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE owner_email = 'yaa2003ya@gmail.com')
RETURNING id;

-- 6.3 Create admin user (without auth_user_id for now)
INSERT INTO admin_users (email, is_super_admin)
SELECT 'yaa2003ya@gmail.com', TRUE
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'yaa2003ya@gmail.com')
RETURNING id;

-- ============================================
-- PHASE 7: MIGRATE EXISTING DATA (SAFE)
-- ============================================

-- 7.1 Populate clients with default shop_id
UPDATE clients
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

-- 7.2 Populate services with default shop_id
UPDATE services
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

-- 7.3 Populate barbers with default shop_id
UPDATE barbers
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

-- 7.4 Populate transactions with default shop_id
UPDATE transactions
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

-- 7.5 Populate expenses with default shop_id
UPDATE expenses
SET shop_id = (SELECT id FROM shops WHERE owner_email = 'yaa2003ya@gmail.com' LIMIT 1)
WHERE shop_id IS NULL;

-- ============================================
-- PHASE 8: VERIFY MIGRATION (Before NOT NULL)
-- ============================================

-- Verify all rows are populated with shop_id
DO $$
DECLARE
  total_clients_null INT;
  total_services_null INT;
  total_barbers_null INT;
  total_transactions_null INT;
  total_expenses_null INT;
BEGIN
  SELECT COUNT(*) INTO total_clients_null FROM clients WHERE shop_id IS NULL;
  SELECT COUNT(*) INTO total_services_null FROM services WHERE shop_id IS NULL;
  SELECT COUNT(*) INTO total_barbers_null FROM barbers WHERE shop_id IS NULL;
  SELECT COUNT(*) INTO total_transactions_null FROM transactions WHERE shop_id IS NULL;
  SELECT COUNT(*) INTO total_expenses_null FROM expenses WHERE shop_id IS NULL;

  IF total_clients_null > 0 OR total_services_null > 0 OR total_barbers_null > 0 
     OR total_transactions_null > 0 OR total_expenses_null > 0 THEN
    RAISE EXCEPTION 'Migration incomplete! Found NULL shop_ids. Clients: %, Services: %, Barbers: %, Transactions: %, Expenses: %',
      total_clients_null, total_services_null, total_barbers_null, total_transactions_null, total_expenses_null;
  ELSE
    RAISE NOTICE 'Migration verification: All rows have shop_id ✓';
  END IF;
END $$;

-- ============================================
-- PHASE 9: SET shop_id TO NOT NULL
-- ============================================

ALTER TABLE clients
ALTER COLUMN shop_id SET NOT NULL;

ALTER TABLE services
ALTER COLUMN shop_id SET NOT NULL;

ALTER TABLE barbers
ALTER COLUMN shop_id SET NOT NULL;

ALTER TABLE transactions
ALTER COLUMN shop_id SET NOT NULL;

ALTER TABLE expenses
ALTER COLUMN shop_id SET NOT NULL;

ALTER TABLE usage_logs
ALTER COLUMN shop_id SET NOT NULL;

-- ============================================
-- PHASE 10: REMOVE OLD RLS POLICIES
-- ============================================

-- Drop all old permissive policies
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

DROP POLICY IF EXISTS "Enable read access for all users" ON settings;

-- ============================================
-- PHASE 11: ENABLE RLS & CREATE NEW POLICIES
-- ============================================

-- Enable RLS on all multi-tenant tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Enable RLS on admin-only tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PHASE 12: MULTI-TENANT RLS POLICIES
-- Shops can only access their own data
-- ============================================

-- CLIENTS POLICIES
-- Shop can read its own clients, admins can read all
CREATE POLICY "clients_read_own" ON clients
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Shop can insert clients
CREATE POLICY "clients_insert_own" ON clients
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Shop can update clients
CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Shop can delete clients
CREATE POLICY "clients_delete_own" ON clients
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- SERVICES POLICIES
-- Shop can read its own services, admins can read all
CREATE POLICY "services_read_own" ON services
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "services_insert_own" ON services
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "services_update_own" ON services
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "services_delete_own" ON services
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- BARBERS POLICIES
-- Shop can read its own barbers, admins can read all
CREATE POLICY "barbers_read_own" ON barbers
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "barbers_insert_own" ON barbers
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "barbers_update_own" ON barbers
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "barbers_delete_own" ON barbers
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- TRANSACTIONS POLICIES
-- Shop can read its own transactions, admins can read all
CREATE POLICY "transactions_read_own" ON transactions
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "transactions_insert_own" ON transactions
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "transactions_update_own" ON transactions
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "transactions_delete_own" ON transactions
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- EXPENSES POLICIES
-- Shop can read its own expenses, admins can read all
CREATE POLICY "expenses_read_own" ON expenses
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "expenses_insert_own" ON expenses
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "expenses_update_own" ON expenses
  FOR UPDATE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "expenses_delete_own" ON expenses
  FOR DELETE
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- ============================================
-- PHASE 13: ADMIN-ONLY RLS POLICIES
-- ============================================

-- SHOPS POLICIES (Admin only)
CREATE POLICY "shops_admin_read" ON shops
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "shops_admin_insert" ON shops
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "shops_admin_update" ON shops
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "shops_admin_delete" ON shops
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- ADMIN USERS POLICIES (Admin only)
CREATE POLICY "admin_users_admin_read" ON admin_users
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "admin_users_admin_insert" ON admin_users
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "admin_users_admin_update" ON admin_users
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "admin_users_admin_delete" ON admin_users
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- PLANS POLICIES (Admin only)
CREATE POLICY "plans_admin_read" ON plans
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "plans_admin_insert" ON plans
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "plans_admin_update" ON plans
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "plans_admin_delete" ON plans
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- USAGE LOGS POLICIES (Admin only + Shops can view their own)
CREATE POLICY "usage_logs_shop_read" ON usage_logs
  FOR SELECT
  USING (
    shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "usage_logs_admin_insert" ON usage_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- ============================================
-- PHASE 14: FINAL VERIFICATION
-- ============================================

SELECT '✓ Migration Complete!' as Status;

-- Show summary
SELECT 
  'SUMMARY' as Report,
  NOW() as Completed,
  (SELECT COUNT(*) FROM shops) as Total_Shops,
  (SELECT COUNT(*) FROM admin_users) as Total_Admins,
  (SELECT COUNT(*) FROM plans) as Total_Plans,
  (SELECT COUNT(*) FROM clients WHERE shop_id IS NOT NULL) as Clients_Migrated,
  (SELECT COUNT(*) FROM services WHERE shop_id IS NOT NULL) as Services_Migrated,
  (SELECT COUNT(*) FROM barbers WHERE shop_id IS NOT NULL) as Barbers_Migrated,
  (SELECT COUNT(*) FROM transactions WHERE shop_id IS NOT NULL) as Transactions_Migrated,
  (SELECT COUNT(*) FROM expenses WHERE shop_id IS NOT NULL) as Expenses_Migrated;

-- ============================================
-- END OF MIGRATION SCRIPT
-- ============================================
-- NEXT STEPS:
-- 1. Connect auth_user_id after users sign up in Supabase Auth
-- 2. Implement shop login in frontend
-- 3. Pass auth.uid() in API calls for RLS enforcement
-- 4. Implement billing calculation dashboard
-- ============================================
