-- Final fix for profiles table RLS issues
-- Run this ENTIRE script in Supabase SQL Editor

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- 2. Temporarily disable RLS to test
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop ALL policies again
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 5. Create super simple policies with explicit service role bypass
CREATE POLICY "Enable all operations for authenticated users on their own profile"
  ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. Add a separate SELECT policy for viewing all profiles
CREATE POLICY "Enable read for all authenticated users"
  ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 7. Verify the policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- 8. Test creating a profile directly (replace with your values)
-- Get your user ID from Supabase Dashboard > Authentication > Users
-- INSERT INTO profiles (id, email, full_name)
-- VALUES (
--   'YOUR-USER-ID',
--   'your-email@example.com',
--   'Your Name'
-- );

-- 9. If still having issues, check if the auth.uid() function works
SELECT auth.uid();

-- 10. Alternative: Temporarily allow all inserts (FOR TESTING ONLY)
-- Run this if nothing else works:
-- DROP POLICY IF EXISTS "Enable all operations for authenticated users on their own profile" ON profiles;
-- DROP POLICY IF EXISTS "Enable read for all authenticated users" ON profiles;
-- CREATE POLICY "Allow all for testing" ON profiles FOR ALL USING (true) WITH CHECK (true);