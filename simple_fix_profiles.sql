-- Simple fix for profiles table
-- Run this in Supabase SQL Editor

-- 1. Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- 2. Create simple, working policies
CREATE POLICY "Enable read access for all users"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for users based on user_id"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Verify the policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. Test by manually inserting a profile for any existing auth users
-- Get your user ID from Supabase Dashboard > Authentication > Users
-- Then uncomment and run:
-- INSERT INTO profiles (id, email, full_name, created_at, updated_at)
-- VALUES (
--   'YOUR-USER-ID-HERE',
--   'your-email@example.com',
--   'Your Name',
--   NOW(),
--   NOW()
-- ) ON CONFLICT (id) DO NOTHING;