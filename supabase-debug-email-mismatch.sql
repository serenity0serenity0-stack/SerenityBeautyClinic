-- ============================================================================
-- DEBUG: Check Email Mismatch Issue
-- ============================================================================

-- Show portal_users and their corresponding auth.users emails
SELECT 
  pu.id,
  pu.phone,
  pu.email as "portal_users_email",
  au.email as "auth_users_email",
  CASE 
    WHEN pu.email = au.email THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status
FROM portal_users pu
LEFT JOIN auth.users au ON pu.id = au.id
ORDER BY pu.created_at DESC;

-- Check authentication info for the specific user
SELECT 
  id,
  email,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmed_at
FROM auth.users
WHERE email = 'google@gmail.com'
ORDER BY created_at DESC;
