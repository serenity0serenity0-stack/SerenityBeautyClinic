-- ============================================================================
-- REPLACE OLD PORTAL_USERS RECORD WITH NEW SESSION ID
-- ============================================================================
-- Delete the old record and create one for the current session

-- First, delete the old record (if needed)
DELETE FROM portal_users 
WHERE phone = '01000139411' 
  AND shop_id = 'ef8f12b6-de83-4043-84e6-f3a386262a5e'
  AND id != '73cfb82f-c3c1-432f-b6a7-932b2a3ea5ae';

-- Then create/update the current session record
INSERT INTO portal_users (
  id,
  shop_id,
  phone,
  email,
  name,
  created_at
) VALUES (
  '73cfb82f-c3c1-432f-b6a7-932b2a3ea5ae',
  'ef8f12b6-de83-4043-84e6-f3a386262a5e',
  '01000139411',
  'google@gmail.com',
  'didi',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  name = EXCLUDED.name;

-- Verify it was created
SELECT * FROM portal_users WHERE id = '73cfb82f-c3c1-432f-b6a7-932b2a3ea5ae';
