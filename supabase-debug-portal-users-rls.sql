-- ============================================================================
-- DEBUG: Check portal_users records and RLS policies
-- ============================================================================

-- Query 1: Check all portal_users for the shop
SELECT 
  id,
  shop_id,
  phone,
  email,
  name,
  created_at
FROM portal_users
WHERE shop_id = 'ef8f12b6-de83-4043-84e6-f3a386262a5e'
ORDER BY created_at DESC;

-- Query 2: Check if portal_users RLS policy exists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'portal_users'
ORDER BY policyname;

-- Query 3: Check for the specific userId (from error)
SELECT 
  id,
  shop_id,
  phone,
  email,
  name,
  created_at,
  'Portal user found' as status
FROM portal_users
WHERE id = '73cfb82f-c3c1-432f-b6a7-932b2a3ea5ae'

UNION ALL

SELECT 
  NULL::uuid,
  NULL::uuid,
  'N/A',
  'N/A',
  'Not found',
  NOW(),
  'Portal user NOT found'
WHERE NOT EXISTS (
  SELECT 1 FROM portal_users 
  WHERE id = '73cfb82f-c3c1-432f-b6a7-932b2a3ea5ae'
);

-- Query 4: Count portal users per shop
SELECT 
  shop_id,
  COUNT(*) as portal_user_count
FROM portal_users
GROUP BY shop_id;

-- Query 5: Check RLS is enabled on portal_users
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'portal_users' AND schemaname = 'public';
