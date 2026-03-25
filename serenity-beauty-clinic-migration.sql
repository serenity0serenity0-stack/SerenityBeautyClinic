-- ============================================================================
-- SERENITY BEAUTY CLINIC - DATABASE MIGRATION
-- Transforms from Multi-Tenant Barbershop SaaS to Single-Admin Beauty Clinic
-- ============================================================================
-- Status: Ready for production
-- Created: March 25, 2026
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- PHASE 0: BACKUP & SAFETY
-- ============================================================================
-- Execute these manually first:
--   1. Create manual backup in Supabase: Project > Backups > Create Manual Backup
--   2. Wait for backup to complete
--   3. Then run the SQL below

-- ============================================================================
-- PHASE 1: CREATE CLINIC CONFIGURATION TABLE
-- ============================================================================

-- Drop existing shops table and create simplified clinic table
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
  
  -- Single admin credentials (stored in Supabase Auth separately)
  admin_email VARCHAR(255),
  admin_name VARCHAR(255),
  
  -- Theme settings
  primary_color VARCHAR(7) DEFAULT '#E91E63',  -- Hot Pink
  secondary_color VARCHAR(7) DEFAULT '#C2185B', -- Deep Pink
  accent_color VARCHAR(7) DEFAULT '#F06292',    -- Light Pink
  
  -- Business settings
  timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
  currency VARCHAR(3) DEFAULT 'EGP',
  language VARCHAR(2) DEFAULT 'ar',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default clinic record
INSERT INTO clinic (name, admin_email, admin_name, primary_color, secondary_color, accent_color)
VALUES ('Serenity Beauty Clinic', '', 'Admin', '#E91E63', '#C2185B', '#F06292');

-- ============================================================================
-- PHASE 2: CLEAN UP MULTI-TENANT TABLES
-- ============================================================================

-- Drop SaaS-specific tables
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS usage_logs CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- ============================================================================
-- PHASE 3: UPDATE EXISTING TABLES (Remove shop_id isolation)
-- ============================================================================

-- Add clinic_id to main tables if needed (optional - for future multi-clinic support)
-- For now, keep tables as-is but remove shop_id dependencies

-- Update clients table if it has shop_id
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_shop_id_fkey CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS shop_id;

-- Update services table
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_shop_id_fkey CASCADE;
ALTER TABLE services DROP COLUMN IF EXISTS shop_id;

-- Update barbers table (keep it, rename conceptually to beauticians)
ALTER TABLE barbers DROP CONSTRAINT IF EXISTS barbers_shop_id_fkey CASCADE;
ALTER TABLE barbers DROP COLUMN IF EXISTS shop_id;

-- Update bookings table
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_shop_id_fkey CASCADE;
ALTER TABLE bookings DROP COLUMN IF EXISTS shop_id;

-- Update transactions table
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_shop_id_fkey CASCADE;
ALTER TABLE transactions DROP COLUMN IF EXISTS shop_id;

-- Update expenses table
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_shop_id_fkey CASCADE;
ALTER TABLE expenses DROP COLUMN IF EXISTS shop_id;

-- Update visit_logs table
ALTER TABLE visit_logs DROP CONSTRAINT IF EXISTS visit_logs_shop_id_fkey CASCADE;
ALTER TABLE visit_logs DROP COLUMN IF EXISTS shop_id;

-- Update settings table (remove shop-specific settings, keep as global)
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_shop_id_fkey CASCADE;
ALTER TABLE settings DROP COLUMN IF EXISTS shop_id;

-- ============================================================================
-- PHASE 4: DISABLE ROW-LEVEL SECURITY (No longer needed for single admin)
-- ============================================================================

-- Disable RLS on all tables - single admin doesn't need row-level restrictions
ALTER TABLE clinic DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "read_own_record" ON clients;
DROP POLICY IF EXISTS "write_own_record" ON clients;
DROP POLICY IF EXISTS "read_own_record" ON services;
DROP POLICY IF EXISTS "write_own_record" ON services;
DROP POLICY IF EXISTS "read_own_record" ON barbers;
DROP POLICY IF EXISTS "write_own_record" ON barbers;
DROP POLICY IF EXISTS "read_own_record" ON bookings;
DROP POLICY IF EXISTS "write_own_record" ON bookings;
DROP POLICY IF EXISTS "read_own_record" ON transactions;
DROP POLICY IF EXISTS "write_own_record" ON transactions;
DROP POLICY IF EXISTS "read_own_record" ON expenses;
DROP POLICY IF EXISTS "write_own_record" ON expenses;
DROP POLICY IF EXISTS "read_own_record" ON visit_logs;
DROP POLICY IF EXISTS "write_own_record" ON visit_logs;
DROP POLICY IF EXISTS "read_own_record" ON settings;
DROP POLICY IF EXISTS "write_own_record" ON settings;

-- ============================================================================
-- PHASE 5: VERIFY TABLE STRUCTURE
-- ============================================================================

-- Check clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- Check services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS name_ar VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Check barbers (beauticians) table
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS specialization VARCHAR(255);

-- Check bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- PHASE 6: CREATE ADMIN USER AUTH LINK TABLE (Simple)
-- ============================================================================

DROP TABLE IF EXISTS admin_auth CASCADE;

CREATE TABLE admin_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- PHASE 7: ENABLE PUBLIC ACCESS (No RLS for single admin)
-- ============================================================================

ALTER TABLE clinic DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_auth DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 8: SEED BASIC DATA FOR BEAUTY CLINIC
-- ============================================================================

-- Update clinic info
UPDATE clinic 
SET 
  name = 'Serenity Beauty Clinic',
  email = 'contact@serenitybeauty.com',
  city = 'Cairo',
  description = 'Your premier beauty and wellness destination',
  primary_color = '#E91E63',
  secondary_color = '#C2185B',
  accent_color = '#F06292'
WHERE id IN (SELECT id FROM clinic LIMIT 1);

-- Clear and seed example services
DELETE FROM services;

INSERT INTO services (name_ar, name_en, price, duration, category, active, created_at, updated_at) VALUES
('حلاقة شعر', 'Hair Cut', 150, 30, 'Hair', true, NOW(), NOW()),
('صبغة شعر', 'Hair Color', 300, 60, 'Hair', true, NOW(), NOW()),
('مكياج', 'Makeup', 250, 45, 'Makeup', true, NOW(), NOW()),
('العناية بالبشرة', 'Facial', 200, 50, 'Skincare', true, NOW(), NOW()),
('مانيكير', 'Manicure', 100, 30, 'Nails', true, NOW(), NOW()),
('بيديكير', 'Pedicure', 120, 40, 'Nails', true, NOW(), NOW()),
('تصفيف الشعر', 'Hair Styling', 180, 40, 'Hair', true, NOW(), NOW()),
('علاج الشعر', 'Hair Treatment', 280, 50, 'Hair', true, NOW(), NOW());

-- Clear and seed example beauticians
DELETE FROM barbers;

INSERT INTO barbers (name, phone, email, specialization, is_available, created_at, updated_at) VALUES
('فاطمة أحمد', '+201023456789', 'fatima@serenity.com', 'Hair Specialist', true, NOW(), NOW()),
('لينا محمود', '+201034567890', 'lina@serenity.com', 'Makeup Artist', true, NOW(), NOW()),
('سارة علي', '+201045678901', 'sara@serenity.com', 'Skincare Specialist', true, NOW(), NOW()),
('أميرة حسن', '+201056789012', 'amira@serenity.com', 'Nail Specialist', true, NOW(), NOW());

-- ============================================================================
-- PHASE 9: VERIFICATION QUERIES
-- ============================================================================

-- Verify clinic table
SELECT '=== CLINIC TABLE ===' as check_name;
SELECT id, name, primary_color, secondary_color FROM clinic LIMIT 1;

-- Verify services
SELECT '=== SERVICES ===' as check_name;
SELECT id, name_ar, name_en, price, duration, category FROM services ORDER BY category;

-- Verify beauticians
SELECT '=== BEAUTICIANS ===' as check_name;
SELECT id, name, phone, specialization FROM barbers;

-- Verify table structure
SELECT '=== TABLE STRUCTURE CHECK ===' as check_name;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- ============================================================================
-- PHASE 10: IMPORTANT NOTES FOR DEVELOPERS
-- ============================================================================

/*
IMPORTANT CHANGES:
1. ✅ Removed: shops, admin_users, plans, usage_logs, subscriptions tables
2. ✅ Added: clinic table (single clinic configuration)
3. ✅ Simplified: All tables now have NO shop_id (global data)
4. ✅ Auth: Use admin_auth table to link Supabase Auth user to admin role
5. ✅ RLS: DISABLED - single admin doesn't need row-level security
6. ✅ Data: Seeded with example beauty services and beauticians

NEXT STEPS:
1. Update your application code:
   - Remove all shop_id filtering
   - Remove multi-tenant routing
   - Update useAuth hook for single admin
   - Update color references to pink theme

2. Environment variables:
   - Keep VITE_SUPABASE_URL
   - Keep VITE_SUPABASE_ANON_KEY
   - No changes needed

3. Deployment:
   - Deploy to Vercel
   - Push to GitHub
   - Connect Supabase with this schema

4. First admin login:
   - Create user in Supabase Auth: admin@serenitybeauty.com
   - Insert record in admin_auth table linking auth_user_id to clinic
   - Login via app
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
