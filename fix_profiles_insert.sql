-- URGENT: Fix profiles table to allow users to create their profile
-- Run this entire script in Supabase SQL Editor

-- 1. First, add the missing INSERT policy for profiles
CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. Verify all policies are in place
SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- You should see:
-- - INSERT: "Users can create their own profile"
-- - SELECT: "Users can view all profiles"  
-- - UPDATE: "Users can update their own profile"

-- 3. If you still have issues, run this to ensure the trigger exists:
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE
  SET email = NEW.email,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();