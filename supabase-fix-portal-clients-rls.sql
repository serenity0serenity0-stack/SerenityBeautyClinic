-- ============================================================================
-- FIX: Portal Users - RLS Policies to Create Client Records
-- ============================================================================
-- Problem: Portal users register and create portal_users record, but can't insert
-- into clients table due to missing RLS policies
--
-- Solution: Add policies allowing portal users to:
-- 1. INSERT their own client record during registration
-- 2. READ clients table for duplicate phone check
-- ============================================================================

-- Step 1: Add policies to allow portal users to insert their own client record
-- ============================================================================

-- Drop existing portal user client policies if they exist
DROP POLICY IF EXISTS "portal_users_insert_own_client" ON clients;
DROP POLICY IF EXISTS "portal_users_read_clients_for_portal" ON clients;

-- Allow portal users to INSERT their own client record
-- This specifically allows auth.uid() to insert a client with their phone number
CREATE POLICY "portal_users_insert_own_client" ON clients
FOR INSERT TO authenticated
WITH CHECK (
  -- Check 1: The client's shop_id matches a shop where user has a portal_users record
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  AND
  -- Check 2: The phone being inserted matches the portal user's phone (security check)
  phone = (
    SELECT phone FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
);

-- Allow portal users to READ clients in their shop
-- Needed for duplicate check during registration and to view clients in their shop
CREATE POLICY "portal_users_read_clients_for_portal" ON clients
FOR SELECT TO authenticated
USING (
  shop_id = (
    SELECT shop_id FROM portal_users 
    WHERE id = auth.uid() 
    LIMIT 1
  )
  -- Also allow shop owners and admins to read
  OR shop_id = (SELECT id FROM shops WHERE auth_user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
);

-- Step 2: Backfill - Create client records for existing portal_users who don't have one
-- ============================================================================
-- This inserts a client record for each portal_user that doesn't already have a matching phone
INSERT INTO clients (
  shop_id, 
  name, 
  phone, 
  totalvisits, 
  totalspent, 
  isvip, 
  notes, 
  createdat, 
  updatedat
)
SELECT 
  pu.shop_id,
  COALESCE(pu.name, pu.phone) as name,
  pu.phone,
  0 as totalvisits,
  0 as totalspent,
  false as isvip,
  'مسجل عبر البوابة الإلكترونية' as notes,
  pu.created_at as createdat,
  pu.created_at as updatedat
FROM portal_users pu
WHERE NOT EXISTS (
  SELECT 1 FROM clients c 
  WHERE c.shop_id = pu.shop_id 
  AND c.phone = pu.phone
)
ON CONFLICT (phone) DO NOTHING;

-- Step 3: Verify backfill worked
-- ============================================================================
-- Count results of backfill
SELECT 
  'Backfill Summary:' as message,
  COUNT(DISTINCT pu.shop_id) as shops_processed,
  COUNT(DISTINCT pu.phone) as portal_users_processed,
  COUNT(c.id) as new_clients_created,
  COUNT(DISTINCT c.shop_id) as shops_with_clients
FROM portal_users pu
LEFT JOIN clients c ON c.phone = pu.phone AND c.shop_id = pu.shop_id AND c.notes LIKE '%البوابة الإلكترونية%';

-- Step 4: Log details of created clients
-- ============================================================================
SELECT 
  pu.phone,
  pu.name as portal_user_name,
  c.name as client_name,
  c.shop_id,
  c.createdAt,
  'Created during backfill' as status
FROM portal_users pu
LEFT JOIN clients c ON c.phone = pu.phone AND c.shop_id = pu.shop_id
WHERE c.id IS NOT NULL
ORDER BY pu.created_at DESC;
