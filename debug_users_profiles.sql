-- Debug why auth users don't match profiles
-- Run this in Supabase SQL Editor

-- 1. Show ALL auth users
SELECT id, email FROM auth.users ORDER BY email;

-- 2. Show ALL profiles
SELECT id, email FROM profiles ORDER BY email;

-- 3. Find mismatched IDs (auth users and profiles with same email but different IDs)
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    p.id as profile_id,
    p.email as profile_email
FROM auth.users au
FULL OUTER JOIN profiles p ON au.email = p.email
WHERE au.id != p.id OR au.id IS NULL OR p.id IS NULL
ORDER BY COALESCE(au.email, p.email);

-- 4. The fix: Update profiles to use the correct auth user IDs
-- This will match profiles to auth users by email and update the profile ID
UPDATE profiles p
SET id = au.id
FROM auth.users au
WHERE p.email = au.email
AND p.id != au.id;

-- 5. Verify the fix worked
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    p.id as profile_id,
    p.email as profile_email
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY au.email;

-- Should now show matching IDs for both users