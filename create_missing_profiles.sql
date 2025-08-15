-- Create the missing profiles for your existing users
-- Run this in Supabase SQL Editor

-- Create profiles for both users
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
VALUES 
  ('a9f53073-fee2-486c-9d2c-14cdec29f455', 'jordynhay05@gmail.com', 'jordynhay05@gmail.com', NOW(), NOW()),
  ('a3ba3ed0-85fb-4bcb-a95c-dc5ec98f1abc', 'hoobahubz@gmail.com', 'hoobahubz@gmail.com', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  updated_at = NOW();

-- Verify they were created
SELECT * FROM profiles;

-- Now you should be able to log in with either account!