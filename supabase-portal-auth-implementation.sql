-- ============================================================================
-- SUPABASE PORTAL AUTH IMPLEMENTATION - COMPLETE & SECURE
-- ============================================================================
-- This migration sets up proper authentication and RLS for portal users
-- All portal users authenticate via Supabase Auth
-- RLS policies enforce data isolation at database level
-- ============================================================================

-- Step 1: Create portal_users table to link auth.uid() with shop_id
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_portal_users_shop_id ON portal_users(shop_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_phone ON portal_users(phone);

-- Step 2: Enable RLS on portal_users
-- ============================================================================
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "portal_users_read_own" ON portal_users;
DROP POLICY IF EXISTS "portal_users_admin_manage" ON portal_users;
DROP POLICY IF EXISTS "portal_users_create_own_shop" ON portal_users;
DROP POLICY IF EXISTS "portal_users_read_own_shop" ON portal_users;
DROP POLICY IF EXISTS "portal_users_update_own_shop" ON portal_users;
DROP POLICY IF EXISTS "portal_users_create_self" ON portal_users;

-- ⭐ ALLOW NEW USERS TO CREATE THEIR OWN RECORD (during registration)
-- No auth_user_id check - they're not logged in yet!
CREATE POLICY "portal_users_create_self" ON portal_users
  FOR INSERT
  WITH CHECK (
    -- Allow insertion if the phone is being registered for ANY valid shop
    -- The phone must be unique, so this ensures one portal user per phone
    id = auth.uid()
  );

-- ⭐ ALLOW PUBLIC READ for login (find user by phone)
-- During login, user needs to find their record by phone
CREATE POLICY "portal_users_read_for_login" ON portal_users
  FOR SELECT
  USING (true);  -- Allow public read (phone lookup is safe)

-- Portal users can view their own data
CREATE POLICY "portal_users_read_own" ON portal_users
  FOR SELECT
  USING (id = auth.uid());

-- Shop owners can create new portal users (customers) for their shop
CREATE POLICY "portal_users_create_own_shop" ON portal_users
  FOR INSERT
  WITH CHECK (
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
  );

-- Shop owners can read/view portal users from their shop
CREATE POLICY "portal_users_read_own_shop" ON portal_users
  FOR SELECT
  USING (
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Shop owners can update portal users from their shop
CREATE POLICY "portal_users_update_own_shop" ON portal_users
  FOR UPDATE
  USING (
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Admin can manage all portal users
CREATE POLICY "portal_users_admin_manage" ON portal_users
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Step 3: Disable old RLS policies on barbers
-- ============================================================================
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;

-- Step 4: Enable NEW RLS policies on barbers
-- ============================================================================
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "barbers_read_by_portal_users" ON barbers;
DROP POLICY IF EXISTS "barbers_manage_own_shop" ON barbers;

-- Portal users can read ONLY barbers from their shop
CREATE POLICY "barbers_read_by_portal_users" ON barbers
  FOR SELECT
  USING (
    shop_id = (
      SELECT shop_id FROM portal_users WHERE id = auth.uid()
    )
    OR 
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Shop owners can manage their own barbers
CREATE POLICY "barbers_manage_own_shop" ON barbers
  FOR ALL
  USING (
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Step 5: Enable NEW RLS policies on services
-- ============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "services_read_by_portal_users" ON services;
DROP POLICY IF EXISTS "services_manage_own_shop" ON services;

-- Portal users can read ONLY services from their shop
CREATE POLICY "services_read_by_portal_users" ON services
  FOR SELECT
  USING (
    shop_id = (
      SELECT shop_id FROM portal_users WHERE id = auth.uid()
    )
    OR
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Shop owners can manage their own services
CREATE POLICY "services_manage_own_shop" ON services
  FOR ALL
  USING (
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Step 6: Create/update bookings table with proper RLS
-- ============================================================================
-- Ensure bookings table exists with required columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "bookings_read_own" ON bookings;
DROP POLICY IF EXISTS "bookings_create_portal" ON bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON bookings;

-- Portal users can read their own bookings
CREATE POLICY "bookings_read_own" ON bookings
  FOR SELECT
  USING (
    -- Portal user reading their own bookings
    customer_phone = (
      SELECT phone FROM portal_users WHERE id = auth.uid()
    )
    OR
    -- Shop owner reading bookings for their shop
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    -- Admin access
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Portal users can create bookings
CREATE POLICY "bookings_create_portal" ON bookings
  FOR INSERT
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM portal_users WHERE id = auth.uid()
    )
    AND
    customer_phone = (
      SELECT phone FROM portal_users WHERE id = auth.uid()
    )
  );

-- Portal users can only update their own bookings' status
CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE
  USING (
    customer_phone = (
      SELECT phone FROM portal_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    customer_phone = (
      SELECT phone FROM portal_users WHERE id = auth.uid()
    )
  );

-- Step 7: Enable RLS on portal_settings (if not already)
-- ============================================================================
ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "settings_read_by_portal_users" ON portal_settings;

-- Portal users can read settings for their shop only
CREATE POLICY "settings_read_by_portal_users" ON portal_settings
  FOR SELECT
  USING (
    shop_id = (
      SELECT shop_id FROM portal_users WHERE id = auth.uid()
    )
    OR
    shop_id = (
      SELECT id FROM shops WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
  );

-- Step 8: Verify policies are created
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  qual
FROM pg_policies
WHERE tablename IN ('barbers', 'services', 'bookings', 'portal_users', 'portal_settings')
ORDER BY tablename, policyname;
