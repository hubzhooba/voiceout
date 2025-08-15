-- Clean up orphaned auth users that don't have profiles
-- Run this in Supabase SQL Editor

-- 1. Find auth users without profiles
SELECT 
    au.id,
    au.email,
    au.created_at,
    p.id as profile_id
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 2. Delete orphaned auth users (users without profiles)
-- CAREFUL: This will delete auth users that don't have profiles
-- Uncomment the lines below to actually delete them:

-- DELETE FROM auth.users
-- WHERE id IN (
--     SELECT au.id
--     FROM auth.users au
--     LEFT JOIN profiles p ON au.id = p.id
--     WHERE p.id IS NULL
--     AND au.email IN ('jordynhay05@gmail.com', 'hoobahubz@gmail.com')
-- );

-- 3. Verify the correct users remain
SELECT 
    au.id,
    au.email,
    p.id as profile_id,
    p.email as profile_email
FROM auth.users au
JOIN profiles p ON au.id = p.id
ORDER BY au.email;