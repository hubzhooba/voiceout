-- Reset password for a user directly in the database
-- Run this in Supabase SQL Editor

-- This will set the password to 'password123' for the specified email
-- Change the email and password as needed

-- For jordynhay05@gmail.com
UPDATE auth.users 
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email = 'jordynhay05@gmail.com';

-- For hoobahubz@gmail.com (uncomment if needed)
-- UPDATE auth.users 
-- SET encrypted_password = crypt('password123', gen_salt('bf'))
-- WHERE email = 'hoobahubz@gmail.com';

-- Verify the update
SELECT id, email, last_sign_in_at 
FROM auth.users 
WHERE email IN ('jordynhay05@gmail.com', 'hoobahubz@gmail.com');