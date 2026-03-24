-- ============================================================================
-- UPDATE existing portal user to use real email
-- ============================================================================

-- Update the phone to use the correct email for Supabase Auth
UPDATE portal_users
SET email = 'google@gmail.com'
WHERE phone = '01000139411';

-- Verify the update
SELECT 
  id,
  shop_id,
  phone,
  email,
  name,
  created_at
FROM portal_users
WHERE phone = '01000139411';
