-- ======================================================
-- SERENITY BEAUTY CLINIC - DATABASE SCHEMA
-- Single Admin, Beauty Services Focus
-- Version: 1.0.0
-- ======================================================

-- ======================================================
-- STEP 1: CREATE EXTENSIONS (if needed)
-- ======================================================

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================================================
-- STEP 2: CREATE ADMIN AUTH TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS admin_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL UNIQUE,
  clinic_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  clinic_name VARCHAR(255) DEFAULT 'Serenity Beauty Clinic',
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================
-- STEP 3: CREATE CORE TABLES
-- ======================================================

-- Therapists/Aestheticians Table (replaces Barbers)
CREATE TABLE IF NOT EXISTS therapists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  specialization VARCHAR(255),
  bio TEXT,
  active BOOLEAN DEFAULT TRUE,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  birthday DATE,
  skin_type VARCHAR(50),
  allergies TEXT,
  notes TEXT,
  total_visits INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  is_vip BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_visit DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Services Table (Beauty Services)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  therapist_name VARCHAR(255),
  service_type VARCHAR(255),
  booking_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER DEFAULT 30,
  queue_number INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table (POS)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  visit_number INTEGER NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(5) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  discount_type VARCHAR(20) DEFAULT 'fixed',
  total DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  therapist_id UUID REFERENCES therapists(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily Logs/Visit Logs Table
CREATE TABLE IF NOT EXISTS visit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES therapists(id),
  service_id UUID REFERENCES services(id),
  visit_date DATE NOT NULL,
  visit_time VARCHAR(5),
  notes TEXT,
  before_notes TEXT,
  after_notes TEXT,
  products_used JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ======================================================

CREATE INDEX ON clients(phone);
CREATE INDEX ON clients(is_vip);
CREATE INDEX ON clients(is_active);
CREATE INDEX ON clients(created_at);
CREATE INDEX ON transactions(date);
CREATE INDEX ON transactions(client_id);
CREATE INDEX ON transactions(payment_method);
CREATE INDEX ON expenses(date);
CREATE INDEX ON expenses(category);
CREATE INDEX ON services(category);
CREATE INDEX ON services(active);
CREATE INDEX ON bookings(client_id);
CREATE INDEX ON bookings(therapist_id);
CREATE INDEX ON bookings(booking_time);
CREATE INDEX ON bookings(status);
CREATE INDEX ON visit_logs(client_id);
CREATE INDEX ON visit_logs(visit_date);

-- ======================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ======================================================

ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ======================================================
-- STEP 6: CREATE RLS POLICIES (For Single Admin)
-- ======================================================

-- Admin Auth - Read only for authenticated users
CREATE POLICY "Admin can view own auth" ON admin_auth
  FOR SELECT USING (auth.uid() = auth_user_id);

-- Therapists - All authenticated users can read
CREATE POLICY "Everyone can read therapists" ON therapists
  FOR SELECT USING (true);

-- Therapists - Admin can manage
CREATE POLICY "Admin can insert therapists" ON therapists
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update therapists" ON therapists
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete therapists" ON therapists
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Clients - All authenticated users can read
CREATE POLICY "Everyone can read clients" ON clients
  FOR SELECT USING (true);

-- Clients - Admin can manage
CREATE POLICY "Admin can insert clients" ON clients
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update clients" ON clients
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete clients" ON clients
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Services - All can read
CREATE POLICY "Everyone can read services" ON services
  FOR SELECT USING (true);

-- Services - Admin can manage
CREATE POLICY "Admin can insert services" ON services
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update services" ON services
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete services" ON services
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Bookings - All can read
CREATE POLICY "Everyone can read bookings" ON bookings
  FOR SELECT USING (true);

-- Bookings - Admin can manage
CREATE POLICY "Admin can insert bookings" ON bookings
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update bookings" ON bookings
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete bookings" ON bookings
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Transactions - All can read
CREATE POLICY "Everyone can read transactions" ON transactions
  FOR SELECT USING (true);

-- Transactions - Admin can manage
CREATE POLICY "Admin can insert transactions" ON transactions
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update transactions" ON transactions
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete transactions" ON transactions
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Expenses - All can read
CREATE POLICY "Everyone can read expenses" ON expenses
  FOR SELECT USING (true);

-- Expenses - Admin can manage
CREATE POLICY "Admin can insert expenses" ON expenses
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update expenses" ON expenses
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete expenses" ON expenses
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Visit Logs - All can read
CREATE POLICY "Everyone can read visit_logs" ON visit_logs
  FOR SELECT USING (true);

-- Visit Logs - Admin can manage
CREATE POLICY "Admin can insert visit_logs" ON visit_logs
  FOR INSERT USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can update visit_logs" ON visit_logs
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));
CREATE POLICY "Admin can delete visit_logs" ON visit_logs
  FOR DELETE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- Settings - All can read
CREATE POLICY "Everyone can read settings" ON settings
  FOR SELECT USING (true);

-- Settings - Admin can manage
CREATE POLICY "Admin can update settings" ON settings
  FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM admin_auth));

-- ======================================================
-- STEP 7: SEED DATA - DEFAULT SERVICES
-- ======================================================

-- Clear existing services
DELETE FROM services;

-- Beauty Services
INSERT INTO services (name_ar, name_en, description_ar, description_en, price, duration, category, active) VALUES
-- Skincare
('تنظيف البشرة', 'Facial Cleansing', 'تنظيف عميق للبشرة', 'Deep facial cleansing', 150.00, 30, 'skincare', true),
('تقشير البشرة', 'Facial Peeling', 'تقشير مع مستحضرات طبيعية', 'Natural peeling treatment', 200.00, 45, 'skincare', true),
('معالجة حب الشباب', 'Acne Treatment', 'معالجة شاملة لحب الشباب', 'Comprehensive acne treatment', 250.00, 60, 'skincare', true),
('ترطيب البشرة', 'Hydration Facial', 'ترطيب مكثف للبشرة الجافة', 'Intensive hydration treatment', 180.00, 45, 'skincare', true),

-- Hair Treatments
('فرد الشعر بالكيراتين', 'Keratin Hair Treatment', 'معالجة فرد الشعر', 'Keratin hair straightening', 300.00, 120, 'hair', true),
('تلوين الشعر', 'Hair Coloring', 'تلوين احترافي', 'Professional hair coloring', 250.00, 90, 'hair', true),
('علاج الشعر المتقصف', 'Hair Repair', 'علاج للشعر التالف', 'Damaged hair repair treatment', 200.00, 60, 'hair', true),
('حمام الشعر الكريمي', 'Hair Spa', 'حمام شعر مرطب', 'Moisturizing hair spa', 150.00, 45, 'hair', true),

-- Nail Services
('تقويم الأظافر', 'Nail Filing', 'تقويم وتشكيل الأظافر', 'Nail shaping and care', 100.00, 30, 'nails', true),
('مانيكير كلاسيكي', 'Classic Manicure', 'مانيكير بسيط', 'Standard manicure', 150.00, 45, 'nails', true),
('مانيكير بديكور', 'Decorated Manicure', 'مانيكير مع ديكوريشن', 'Decorated manicure design', 200.00, 60, 'nails', true),
('بيديكير كامل', 'Full Pedicure', 'العناية الكاملة بالقدمين', 'Complete foot care', 250.00, 75, 'nails', true),

-- Waxing/Hair Removal
('إزالة الشعر بالشمع', 'Waxing', 'إزالة شعر الجسم', 'Body hair removal', 100.00, 30, 'hair_removal', true),
('إزالة شعر الوجه', 'Facial Waxing', 'إزالة شعر الوجه', 'Facial hair removal', 80.00, 20, 'hair_removal', true),
('إزالة شعر الساقين', 'Leg Waxing', 'إزالة شعر الساقين', 'Leg hair removal', 150.00, 45, 'hair_removal', true),

-- Threading/Eyebrows
('تشكيل الحواجب', 'Eyebrow Threading', 'تشكيل احترافي للحواجب', 'Professional eyebrow shaping', 50.00, 20, 'eyebrows', true),
('تلوين الحواجب', 'Eyebrow Tinting', 'تلوين الحواجب', 'Eyebrow tinting', 60.00, 15, 'eyebrows', true),

-- Massage
('مساج الوجه والرقبة', 'Facial Massage', 'مساج استرخائي', 'Relaxing facial massage', 120.00, 30, 'massage', true),
('مساج العلاجي', 'Swedish Massage', 'مساج علاجي كامل الجسم', 'Full body therapeutic massage', 300.00, 90, 'massage', true);

-- ======================================================
-- STEP 8: SEED DATA - DEFAULT THERAPISTS
-- ======================================================

DELETE FROM therapists;

INSERT INTO therapists (name, phone, specialization, bio, active) VALUES
('فاطمة علي', '01000000001', 'العناية بالبشرة', 'خبيرة تجميل متخصصة في العناية بالبشرة', true),
('ليلى محمد', '01000000002', 'تصفيف الشعر', 'متخصصة في معالجات الشعر والتلوين', true),
('روان أحمد', '01000000003', 'الأظافر والمانيكير', 'فنانة أظافر بخبرة 5 سنوات', true),
('دينا حسن', '01000000004', 'المساج والاسترخاء', 'معالجة مساج محترفة', true),
('سارة إبراهيم', '01000000005', 'إزالة الشعر', 'متخصصة في جميع طرق إزالة الشعر', true);

-- ======================================================
-- STEP 9: SEED DATA - DEFAULT CLIENTS (SAMPLE)
-- ======================================================

DELETE FROM clients;

INSERT INTO clients (name, phone, email, skin_type, notes, total_visits, is_active) VALUES
('أم محمد', '01111111111', 'client1@example.com', 'normal', 'عميلة جديدة', 0, true),
('سالم الله', '01111111112', 'client2@example.com', 'oily', 'تفضل الخدمات الطبيعية', 0, true),
('أم عمر', '01111111113', 'client3@example.com', 'dry', 'تحتاج ترطيب مكثف', 0, true);

-- ======================================================
-- STEP 10: INITIALIZE SETTINGS
-- ======================================================

DELETE FROM settings;

INSERT INTO settings (key, value) VALUES
('clinic_name', '"Serenity Beauty Clinic"'),
('clinic_phone', '"01000000000"'),
('clinic_email', '"info@serenitybeautyclinic.com"'),
('working_hours', '{"from": "09:00", "to": "21:00"}'),
('currency', '"EGP"'),
('language', '"ar"'),
('theme', '"dark"'),
('tax_rate', '0.14'),
('booking_interval', '30'),
('queue_buffer', '20');

-- ======================================================
-- STEP 11: VERIFICATION QUERIES
-- ======================================================

-- Verify all tables created successfully
SELECT 
  table_name,
  column_count,
  'Created' as status
FROM (
  SELECT table_name, COUNT(*) as column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
  GROUP BY table_name
) t
WHERE table_name IN (
  'admin_auth', 'therapists', 'clients', 'services', 
  'bookings', 'transactions', 'expenses', 'visit_logs', 'settings'
)
ORDER BY table_name;

-- Show created services count
SELECT COUNT(*) as total_services FROM services;

-- Show created therapists count
SELECT COUNT(*) as total_therapists FROM therapists;

-- ======================================================
-- SETUP COMPLETE
-- ======================================================
-- The database is now ready for use!
-- 
-- NEXT STEPS:
-- 1. Create an admin user in Supabase Auth console
-- 2. Copy the auth.uid() from that user
-- 3. Run this query to link admin to clinic:
--    INSERT INTO admin_auth (auth_user_id, clinic_id, email)
--    VALUES ('YOUR_AUTH_UID', gen_random_uuid(), 'your_email@example.com');
-- 4. Connect your React app to Supabase
-- 5. Update .env with your Supabase credentials
-- ======================================================
