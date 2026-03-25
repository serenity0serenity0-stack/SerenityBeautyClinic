-- ============================================================================
-- SERENITY BEAUTY CLINIC - COMPLETE DATABASE MIGRATION
-- Full schema creation from scratch
-- ============================================================================
-- Status: Complete with all tables
-- Created: March 25, 2026
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- STEP 1: CLINIC TABLE
-- ============================================================================
DROP TABLE IF EXISTS clinic CASCADE;

CREATE TABLE clinic (
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

INSERT INTO clinic (name, admin_email, admin_name) 
VALUES ('Serenity Beauty Clinic', '', 'Admin');

-- ============================================================================
-- STEP 2: ADMIN AUTHENTICATION TABLE
-- ============================================================================
DROP TABLE IF EXISTS admin_auth CASCADE;

CREATE TABLE admin_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  auth_user_id UUID NOT NULL,
  clinic_id UUID REFERENCES clinic(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: CLIENTS TABLE
-- ============================================================================
DROP TABLE IF EXISTS clients CASCADE;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) UNIQUE,
  gender VARCHAR(20),
  date_of_birth DATE,
  notes TEXT,
  total_visits INT DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0.00,
  last_visit DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);

-- ============================================================================
-- STEP 4: SERVICES TABLE
-- ============================================================================
DROP TABLE IF EXISTS services CASCADE;

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  duration_minutes INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  image_url VARCHAR(500),
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default services
INSERT INTO services (name, category, base_price, duration_minutes) VALUES
('Hair Cut', 'Hair', 150.00, 30),
('Hair Styling', 'Hair', 200.00, 45),
('Hair Coloring', 'Hair', 350.00, 60),
('Hair Straightening', 'Hair', 400.00, 90),
('Manicure', 'Nails', 100.00, 30),
('Pedicure', 'Nails', 120.00, 45),
('Makeup', 'Makeup', 250.00, 45),
('Facial', 'Skincare', 180.00, 60);

-- ============================================================================
-- STEP 5: SERVICE VARIANTS TABLE
-- ============================================================================
DROP TABLE IF EXISTS service_variants CASCADE;

CREATE TABLE service_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_modifier DECIMAL(10, 2) DEFAULT 0.00,
  duration_adjustment INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- STEP 6: BARBERS/SPECIALISTS TABLE
-- ============================================================================
DROP TABLE IF EXISTS barbers CASCADE;

CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  specialization VARCHAR(255),
  bio TEXT,
  photo_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  experience_years INT DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  total_clients INT DEFAULT 0,
  hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default specialists
INSERT INTO barbers (name, specialization, bio) VALUES
('نور الهدى', 'تخصصات الشعر', 'متخصصة في قص وتصفيف الشعر الحديث'),
('فاتن محمود', 'مكياج احترافي', 'مكياجة محترفة بخبرة 8 سنوات'),
('ليلى علي', 'العناية بالبشرة', 'متخصصة في حمامات البخار والماسكات'),
('منال سالم', 'الأظافر والديكور', 'تصميم اظافر فني وتزيين متقدم');

-- ============================================================================
-- STEP 7: BOOKINGS TABLE
-- ============================================================================
DROP TABLE IF EXISTS bookings CASCADE;

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INT DEFAULT 30,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_barber ON bookings(barber_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- ============================================================================
-- STEP 8: TRANSACTIONS TABLE
-- ============================================================================
DROP TABLE IF EXISTS transactions CASCADE;

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  discount_type VARCHAR(20) DEFAULT 'fixed',
  total DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash',
  status VARCHAR(50) DEFAULT 'completed',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(created_at);
CREATE INDEX idx_transactions_client ON transactions(client_id);
CREATE INDEX idx_transactions_payment ON transactions(payment_method);

-- ============================================================================
-- STEP 9: EXPENSES TABLE
-- ============================================================================
DROP TABLE IF EXISTS expenses CASCADE;

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================================
-- STEP 10: VISIT LOGS TABLE
-- ============================================================================
DROP TABLE IF EXISTS visit_logs CASCADE;

CREATE TABLE visit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visit_logs_date ON visit_logs(visit_date);
CREATE INDEX idx_visit_logs_client ON visit_logs(client_id);

-- ============================================================================
-- STEP 11: SETTINGS TABLE
-- ============================================================================
DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
('clinic_name', 'Serenity Beauty Clinic'),
('clinic_phone', ''),
('clinic_email', ''),
('business_hours_start', '09:00'),
('business_hours_end', '21:00'),
('lunch_break_start', '13:00'),
('lunch_break_end', '14:00'),
('max_concurrent_bookings', '10'),
('booking_confirmation_required', 'true');

-- ============================================================================
-- STEP 12: PORTAL USERS TABLE (for customer portal)
-- ============================================================================
DROP TABLE IF EXISTS portal_users CASCADE;

CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portal_users_phone ON portal_users(phone);
CREATE INDEX idx_portal_users_email ON portal_users(email);

-- ============================================================================
-- STEP 13: PORTAL SETTINGS TABLE
-- ============================================================================
DROP TABLE IF EXISTS portal_settings CASCADE;

CREATE TABLE portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- FINAL: VERIFY TABLES CREATED
-- ============================================================================

-- Check that all tables exist with SELECT
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- STATUS: MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
-- ✓ clinic
-- ✓ admin_auth
-- ✓ clients
-- ✓ services
-- ✓ service_variants
-- ✓ barbers
-- ✓ bookings
-- ✓ transactions
-- ✓ expenses
-- ✓ visit_logs
-- ✓ settings
-- ✓ portal_users
-- ✓ portal_settings
-- ============================================================================
