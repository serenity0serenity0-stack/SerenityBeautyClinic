-- ============================================================================
-- CREATE ADMIN RECORD IN DATABASE
-- ============================================================================
-- Use this SQL to link your Supabase Auth user to the admin_auth table
-- ============================================================================

INSERT INTO admin_auth (email, auth_user_id, clinic_id, role)
VALUES (
  'serenity0serenity0@gmail.com',
  '63822bb8-1adc-4493-9ce3-22e48eb4273b',
  (SELECT id FROM clinic LIMIT 1),
  'admin'
);

-- Verify it was created
SELECT * FROM admin_auth WHERE email = 'serenity0serenity0@gmail.com';

-- ============================================================================
-- DONE! You can now login with:
-- Email: serenity0serenity0@gmail.com
-- Password: [your password from Supabase]
-- ============================================================================
