-- Check and recreate missing profiles (FIXED)
-- Run this in Supabase SQL Editor

-- 1. First, check if profiles table has ANY data
SELECT COUNT(*) as profile_count FROM profiles;

-- 2. Show all profiles (if any)
SELECT * FROM profiles;

-- 3. Show all auth users
SELECT id, email, created_at FROM auth.users;

-- 4. Since profiles are missing, recreate them for the auth users
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
    created_at,
    NOW() as updated_at
FROM auth.users
WHERE id IN (
    'a9f53073-fee2-486c-9d2c-14cdec29f455',  -- jordynhay05@gmail.com
    'a3ba3ed0-85fb-4bcb-a95c-dc5ec98f1abc'   -- hoobahubz@gmail.com
)
ON CONFLICT (id) 
DO UPDATE SET 
    email = EXCLUDED.email,
    updated_at = NOW();

-- 5. Verify profiles were created
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    p.id as profile_id,
    p.email as profile_email,
    p.full_name
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY au.email;

-- 6. Check if email constraint exists, add if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_email_unique' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
    END IF;
END $$;