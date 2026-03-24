-- ============================================================================
-- FIX: Update auth.users email to match portal_users
-- ============================================================================

-- ⚠️ IMPORTANT: This updates the authentication email to match portal_users

UPDATE auth.users
SET email = 'google@gmail.com',
    updated_at = CURRENT_TIMESTAMP
WHERE id = '09969272-0aae-40a4-84e8-f4c16ff51f69';

-- Verify the update
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
WHERE pu.phone = '01000139411';
