-- IMMEDIATE FIX for "violates foreign key constraint" error
-- Run this RIGHT NOW in your Supabase SQL Editor

-- Step 1: Create a profile for your current user
-- Get your user ID from the Auth section in Supabase Dashboard
-- Or run this to see all users:
SELECT id, email FROM auth.users;

-- Step 2: Create profile for each user (if missing)
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  created_at,
  updated_at
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  updated_at = now();

-- Step 3: Verify profiles were created
SELECT 'Profiles created for users:' as status, COUNT(*) as count FROM public.profiles;

-- Now try creating a workspace again - it should work!