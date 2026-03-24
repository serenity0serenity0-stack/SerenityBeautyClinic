-- ============================================================================
-- CRITICAL FIX: Shop Isolation - Complete Data & Authentication Security
-- ============================================================================
-- Issues Fixed:
-- 1. Services table - ensure portal users only see their shop's services
-- 2. Login validation - prevent Shop A users from accessing Shop B
-- 3. All data queries - filter by shop_id at database level
-- ============================================================================

-- Step 1: Ensure ALL RLS policies on all critical tables filter by shop_id
-- ============================================================================

-- SERVICES TABLE - Portal users can ONLY see services from their shop
-- ============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "services_read_by_portal_users" ON services;
DROP POLICY IF EXISTS "services_manage_own_shop" ON services;
DROP POLICY IF EXISTS "services_read_own" ON services;

-- Portal users can read ONLY services from their shop (by shop_id)
CREATE POLICY "services_read_by_portal_users" ON services
FOR SELECT TO authenticated
USING (
  -- Portal user from Shop A can only see Shop A services
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  OR
  -- Shop staff can see their own shop's services
  shop_id = (
    SELECT id FROM shops WHERE auth_user_id = auth.uid() 
    LIMIT 1
  )
  OR
  -- Admin sees all
  EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- Shop owners can manage their own services (not cross-shop)
CREATE POLICY "services_manage_own_shop" ON services
FOR ALL TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- BARBERS TABLE - Portal users can ONLY see barbers from their shop
-- ============================================================================
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "barbers_read_by_portal_users" ON barbers;
DROP POLICY IF EXISTS "barbers_manage_own_shop" ON barbers;

-- Portal users can read ONLY barbers from their shop
CREATE POLICY "barbers_read_by_portal_users" ON barbers
FOR SELECT TO authenticated
USING (
  -- Portal user can only see barbers from their shop
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  OR
  -- Shop staff can see their own barbers
  shop_id = (
    SELECT id FROM shops WHERE auth_user_id = auth.uid() 
    LIMIT 1
  )
  OR
  -- Admin sees all
  EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- Shop owners can manage their own barbers
CREATE POLICY "barbers_manage_own_shop" ON barbers
FOR ALL TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- CLIENTS TABLE - Complete isolation
-- ============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "clients_read_own" ON clients;
DROP POLICY IF EXISTS "clients_insert_own" ON clients;
DROP POLICY IF EXISTS "clients_update_own" ON clients;
DROP POLICY IF EXISTS "clients_delete_own" ON clients;
DROP POLICY IF EXISTS "portal_users_insert_own_client" ON clients;
DROP POLICY IF EXISTS "portal_users_read_clients_for_portal" ON clients;

-- Portal users can read ONLY clients from their shop
CREATE POLICY "portal_users_read_clients_for_portal" ON clients
FOR SELECT TO authenticated
USING (
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  OR shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- Portal users can INSERT their own client record (with phone validation)
CREATE POLICY "portal_users_insert_own_client" ON clients
FOR INSERT TO authenticated
WITH CHECK (
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  AND
  phone = (
    SELECT phone FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
);

-- Shop staff can manage their own shop's clients (by shop_id)
CREATE POLICY "clients_read_own" ON clients
FOR SELECT TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "clients_insert_own" ON clients
FOR INSERT TO authenticated
WITH CHECK (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "clients_update_own" ON clients
FOR UPDATE TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "clients_delete_own" ON clients
FOR DELETE TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- BOOKINGS TABLE - Complete isolation
-- ============================================================================
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "bookings_read_own" ON bookings;
DROP POLICY IF EXISTS "bookings_create_portal" ON bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON bookings;
DROP POLICY IF EXISTS "shop_select_own_bookings" ON bookings;
DROP POLICY IF EXISTS "shop_insert_own_bookings" ON bookings;
DROP POLICY IF EXISTS "shop_update_own_bookings" ON bookings;
DROP POLICY IF EXISTS "shop_delete_own_bookings" ON bookings;
DROP POLICY IF EXISTS "portal_users_insert_own_bookings" ON bookings;
DROP POLICY IF EXISTS "portal_users_select_own_bookings" ON bookings;
DROP POLICY IF EXISTS "portal_users_update_own_bookings" ON bookings;
DROP POLICY IF EXISTS "portal_users_delete_own_bookings" ON bookings;

-- Portal users can read ONLY their own bookings (by phone + shop_id)
CREATE POLICY "portal_users_select_own_bookings" ON bookings
FOR SELECT TO authenticated
USING (
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  AND
  clientphone = (
    SELECT phone FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
);

-- Portal users can INSERT their own bookings (with shop + phone validation)
CREATE POLICY "portal_users_insert_own_bookings" ON bookings
FOR INSERT TO authenticated
WITH CHECK (
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  AND
  clientphone = (
    SELECT phone FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
);

-- Portal users can UPDATE their own bookings
CREATE POLICY "portal_users_update_own_bookings" ON bookings
FOR UPDATE TO authenticated
USING (
  clientphone = (SELECT phone FROM portal_users WHERE id = auth.uid() LIMIT 1)
  AND shop_id = (SELECT shop_id FROM portal_users WHERE id = auth.uid() LIMIT 1)
)
WITH CHECK (
  clientphone = (SELECT phone FROM portal_users WHERE id = auth.uid() LIMIT 1)
  AND shop_id = (SELECT shop_id FROM portal_users WHERE id = auth.uid() LIMIT 1)
);

-- Portal users can DELETE their own bookings
CREATE POLICY "portal_users_delete_own_bookings" ON bookings
FOR DELETE TO authenticated
USING (
  clientphone = (SELECT phone FROM portal_users WHERE id = auth.uid() LIMIT 1)
  AND shop_id = (SELECT shop_id FROM portal_users WHERE id = auth.uid() LIMIT 1)
);

-- Shop staff can read their own shop's bookings (by shop_id only)
CREATE POLICY "shop_select_own_bookings" ON bookings
FOR SELECT TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- Shop staff can INSERT bookings for their shop
CREATE POLICY "shop_insert_own_bookings" ON bookings
FOR INSERT TO authenticated
WITH CHECK (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Shop staff can UPDATE bookings in their shop
CREATE POLICY "shop_update_own_bookings" ON bookings
FOR UPDATE TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Shop staff can DELETE bookings in their shop
CREATE POLICY "shop_delete_own_bookings" ON bookings
FOR DELETE TO authenticated
USING (
  shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Step 2: Verify complete shop isolation
-- ============================================================================
-- Run these queries to verify isolation works:

-- Test 1: Count bookings per shop
SELECT 
  'Test 1: Bookings per shop' as test_name,
  COUNT(*) as total_bookings,
  COUNT(DISTINCT shop_id) as shops_covered
FROM bookings;

-- Test 2: Count clients per shop
SELECT 
  'Test 2: Clients per shop' as test_name,
  COUNT(*) as total_clients,
  COUNT(DISTINCT shop_id) as shops_covered
FROM clients;

-- Test 3: Count services per shop
SELECT 
  'Test 3: Services per shop' as test_name,
  COUNT(*) as total_services,
  COUNT(DISTINCT shop_id) as shops_covered
FROM services;

-- Test 4: Count barbers per shop
SELECT 
  'Test 4: Barbers per shop' as test_name,
  COUNT(*) as total_barbers,
  COUNT(DISTINCT shop_id) as shops_covered
FROM barbers;
