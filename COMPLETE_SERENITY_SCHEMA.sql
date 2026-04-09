-- ============================================================================
-- COMPLETE SERENITY BEAUTY CLINIC DATABASE SCHEMA
-- ============================================================================
-- Comprehensive database setup for single-admin beauty clinic
-- Date: March 25, 2026
-- Run this ENTIRE file to set up complete database from scratch
-- ============================================================================

-- ============================================================================
-- STEP 0: DROP EVERYTHING (CLEAN SLATE)
-- ============================================================================
-- WARNING: This will delete all data. Only run if starting fresh.
-- Uncomment these lines if you need to reset:
/*
DROP TABLE IF EXISTS service_variants CASCADE;
DROP TABLE IF EXISTS visit_logs CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS admin_auth CASCADE;
DROP TABLE IF EXISTS clinic CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS portal_users CASCADE;
DROP TABLE IF EXISTS portal_settings CASCADE;
*/

-- ============================================================================
-- STEP 1: CREATE CLINIC TABLE (Core)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL DEFAULT 'Serenity Beauty Clinic',
  email VARCHAR(255),
  phone VARCHAR(20),
  city VARCHAR(100),
  description TEXT,
  logo_url VARCHAR(500),
  website VARCHAR(255),
  admin_email VARCHAR(255),
  admin_name VARCHAR(255),
  primary_color VARCHAR(7) DEFAULT '#E91E63',
  secondary_color VARCHAR(7) DEFAULT '#C2185B',
  accent_color VARCHAR(7) DEFAULT '#F06292',
  timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
  currency VARCHAR(3) DEFAULT 'EGP',
  language VARCHAR(2) DEFAULT 'ar',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default clinic
INSERT INTO clinic (id, name, admin_email, admin_name, primary_color, secondary_color, accent_color)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'Serenity Beauty Clinic', 'serenity0serenity0@gmail.com', 'Admin', '#E91E63', '#C2185B', '#F06292')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2: CREATE ADMIN AUTHENTICATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  auth_user_id UUID NOT NULL UNIQUE,
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'admin',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert admin user
INSERT INTO admin_auth (email, auth_user_id, clinic_id, role)
VALUES ('serenity0serenity0@gmail.com', '9bf6605a-db64-4024-9245-f23ef16cae37', 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'admin')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: CREATE CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  birthday DATE,
  notes TEXT,
  total_visits INT DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  is_vip BOOLEAN DEFAULT false,
  last_visit DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_clinic_id ON clients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- ============================================================================
-- STEP 4: CREATE BARBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  specialization TEXT,
  bio TEXT,
  image_url VARCHAR(500),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barbers_clinic_id ON barbers(clinic_id);

-- ============================================================================
-- STEP 5: CREATE SERVICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  nameAr VARCHAR(255),
  nameEn VARCHAR(255),
  name VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  duration INT DEFAULT 30,
  category VARCHAR(100),
  description TEXT,
  active BOOLEAN DEFAULT true,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON services(clinic_id);

-- ============================================================================
-- STEP 6: CREATE SERVICE VARIANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  duration INT DEFAULT 30,
  isActive BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_variants_clinic_id ON service_variants(clinic_id);
CREATE INDEX IF NOT EXISTS idx_service_variants_service_id ON service_variants(service_id);

-- ============================================================================
-- STEP 7: CREATE BOOKINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  barber_name VARCHAR(255),
  service_type VARCHAR(255),
  booking_date DATE,
  booking_time TIMESTAMP NOT NULL,
  duration INT DEFAULT 30,
  queue_number INT,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_clinic_id ON bookings(clinic_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_barber_id ON bookings(barber_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);

-- ============================================================================
-- STEP 8: CREATE TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  client_name VARCHAR(255),
  client_phone VARCHAR(20),
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  barber_name VARCHAR(255),
  amount DECIMAL(10, 2),
  discount DECIMAL(10, 2) DEFAULT 0,
  discount_type VARCHAR(50),
  total DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash',
  status VARCHAR(50) DEFAULT 'completed',
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  items JSONB,
  subtotal DECIMAL(10, 2),
  visit_number INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_clinic_id ON transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_barber_id ON transactions(barber_id);

-- ============================================================================
-- STEP 9: CREATE EXPENSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  receipt_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_clinic_id ON expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- ============================================================================
-- STEP 10: CREATE VISIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS visit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  service_type VARCHAR(255),
  duration INT,
  amount DECIMAL(10, 2),
  notes TEXT,
  visit_date DATE NOT NULL,
  visit_number INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_logs_clinic_id ON visit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_client_id ON visit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_visit_date ON visit_logs(visit_date);

-- ============================================================================
-- STEP 11: CREATE SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES clinic(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'professional',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  payment_method VARCHAR(50),
  auto_renew BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic_id ON subscriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Insert default subscription
INSERT INTO subscriptions (clinic_id, plan, status, started_at, expires_at)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'professional', 'active', NOW(), NOW() + INTERVAL '365 days')
ON CONFLICT (clinic_id) DO UPDATE SET status = 'active', updated_at = NOW();

-- ============================================================================
-- STEP 12: CREATE SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_clinic_id ON settings(clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_clinic_key ON settings(clinic_id, key);

-- ============================================================================
-- STEP 13: CREATE PORTAL USERS TABLE (for customer portal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  session_token VARCHAR(500),
  session_expires_at TIMESTAMP,
  last_login TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_users_clinic_id ON portal_users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_client_id ON portal_users(client_id);

-- ============================================================================
-- STEP 14: CREATE PORTAL SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES clinic(id) ON DELETE CASCADE,
  portal_enabled BOOLEAN DEFAULT false,
  portal_title VARCHAR(255) DEFAULT 'Serenity Beauty Clinic',
  portal_description TEXT,
  allow_booking BOOLEAN DEFAULT true,
  allow_profile_edit BOOLEAN DEFAULT true,
  auto_logout_minutes INT DEFAULT 60,
  branding_logo_url VARCHAR(500),
  branding_primary_color VARCHAR(7) DEFAULT '#E91E63',
  branding_secondary_color VARCHAR(7) DEFAULT '#C2185B',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default portal settings
INSERT INTO portal_settings (clinic_id, portal_enabled, portal_title)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', false, 'Serenity Beauty Clinic')
ON CONFLICT (clinic_id) DO NOTHING;

-- ============================================================================
-- STEP 15: ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE clinic ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 16: CREATE RLS POLICIES FOR ADMIN ACCESS
-- ============================================================================

-- Drop all old policies
DROP POLICY IF EXISTS "Everyone can read transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can update transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can delete transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can update expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Admin can read expenses" ON expenses;
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
DROP POLICY IF EXISTS "Enable read access for all users" ON expenses;
DROP POLICY IF EXISTS "Enable insert access for all users" ON expenses;
DROP POLICY IF EXISTS "All users can read expenses" ON expenses;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Enable read access for all users" ON subscriptions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON subscriptions;

-- TRANSACTIONS POLICIES
CREATE POLICY "transactions_admin_select" ON transactions FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "transactions_admin_insert" ON transactions FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id)
);

CREATE POLICY "transactions_admin_update" ON transactions FOR UPDATE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id))
WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id));

CREATE POLICY "transactions_admin_delete" ON transactions FOR DELETE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id));

-- EXPENSES POLICIES
CREATE POLICY "expenses_admin_select" ON expenses FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = expenses.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "expenses_admin_insert" ON expenses FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = expenses.clinic_id)
);

CREATE POLICY "expenses_admin_update" ON expenses FOR UPDATE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = expenses.clinic_id))
WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = expenses.clinic_id));

CREATE POLICY "expenses_admin_delete" ON expenses FOR DELETE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = expenses.clinic_id));

-- CLIENTS POLICIES
CREATE POLICY "clients_admin_select" ON clients FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = clients.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "clients_admin_insert" ON clients FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = clients.clinic_id)
);

CREATE POLICY "clients_admin_update" ON clients FOR UPDATE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = clients.clinic_id))
WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = clients.clinic_id));

-- BARBERS POLICIES
CREATE POLICY "barbers_admin_select" ON barbers FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = barbers.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "barbers_admin_insert" ON barbers FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = barbers.clinic_id)
);

CREATE POLICY "barbers_admin_update" ON barbers FOR UPDATE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = barbers.clinic_id))
WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = barbers.clinic_id));

-- SERVICES POLICIES
CREATE POLICY "services_admin_select" ON services FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = services.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "services_admin_insert" ON services FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = services.clinic_id)
);

CREATE POLICY "services_admin_update" ON services FOR UPDATE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = services.clinic_id))
WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = services.clinic_id));

-- BOOKINGS POLICIES
CREATE POLICY "bookings_admin_select" ON bookings FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = bookings.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "bookings_admin_insert" ON bookings FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = bookings.clinic_id)
);

CREATE POLICY "bookings_admin_update" ON bookings FOR UPDATE
USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = bookings.clinic_id))
WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = bookings.clinic_id));

-- VISIT LOGS POLICIES
CREATE POLICY "visit_logs_admin_select" ON visit_logs FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = visit_logs.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "visit_logs_admin_insert" ON visit_logs FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = visit_logs.clinic_id)
);

-- SUBSCRIPTIONS POLICIES
CREATE POLICY "subscriptions_admin_select" ON subscriptions FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = subscriptions.clinic_id)
);

-- SERVICE VARIANTS POLICIES
CREATE POLICY "service_variants_admin_select" ON service_variants FOR SELECT
USING (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = service_variants.clinic_id)
  OR clinic_id IS NULL
);

CREATE POLICY "service_variants_admin_insert" ON service_variants FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT auth_user_id FROM admin_auth WHERE clinic_id = service_variants.clinic_id)
);

-- ============================================================================
-- STEP 17: INSERT SAMPLE DATA
-- ============================================================================

-- Sample barber
INSERT INTO barbers (clinic_id, name, phone, active)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'أحمد الحلاق', '01001234567', true)
ON CONFLICT DO NOTHING;

-- Sample client
INSERT INTO clients (clinic_id, name, phone, total_visits, total_spent, is_vip)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'محمد علي', '01012345678', 0, 0, false)
ON CONFLICT DO NOTHING;

-- Sample service
INSERT INTO services (clinic_id, nameAr, nameEn, name, price, duration, category, active)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'حلاقة عادية', 'Regular Haircut', 'حلاقة عادية', 50, 20, 'haircut', true)
ON CONFLICT DO NOTHING;

-- Sample transaction
INSERT INTO transactions (clinic_id, client_name, client_phone, amount, total, payment_method, status, date, time)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'محمد علي', '01012345678', 50, 50, 'cash', 'completed', CURRENT_DATE::text, CURRENT_TIME::text)
ON CONFLICT DO NOTHING;

-- Sample expense
INSERT INTO expenses (clinic_id, category, amount, date)
VALUES ('a844c8e8-b7f2-402b-a2a1-d68cc002e8de', 'supplies', 100, CURRENT_DATE::text)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 18: VERIFICATION
-- ============================================================================
SELECT 'DATABASE SETUP COMPLETE' as status;

SELECT 'CLINIC:' as table_name, COUNT(*) FROM clinic WHERE id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'ADMIN_AUTH', COUNT(*) FROM admin_auth WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'SUBSCRIPTIONS', COUNT(*) FROM subscriptions WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'TRANSACTIONS', COUNT(*) FROM transactions WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'EXPENSES', COUNT(*) FROM expenses WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'CLIENTS', COUNT(*) FROM clients WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'BARBERS', COUNT(*) FROM barbers WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de'
UNION ALL
SELECT 'SERVICES', COUNT(*) FROM services WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

-- ============================================================================
-- END OF SETUP
-- ============================================================================
