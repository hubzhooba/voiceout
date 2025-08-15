-- Clean up duplicate policies and ensure profiles table works correctly
-- Run this in Supabase SQL Editor

-- 1. Drop ALL existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- 2. Create only the necessary policies (no duplicates)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Verify we have exactly 3 policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- Should show:
-- INSERT: "Users can insert own profile"
-- SELECT: "Anyone can view profiles"
-- UPDATE: "Users can update own profile"