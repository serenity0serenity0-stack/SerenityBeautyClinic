-- Delete old incorrect record
DELETE FROM admin_auth 
WHERE email = 'serenity0serenity0@gmail.com';

-- Insert correct record with actual auth_user_id
INSERT INTO admin_auth (email, auth_user_id, clinic_id, role)
VALUES (
  'serenity0serenity0@gmail.com',
  '9bf6605a-db64-4024-9245-f23ef16cae37',
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'admin'
);

-- Verify
SELECT * FROM admin_auth WHERE email = 'serenity0serenity0@gmail.com';
