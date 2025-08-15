-- Fix profiles table policies to allow users to create their own profile
-- This is needed for existing auth users after database reset

-- First check existing policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Add INSERT policy if missing
DO $$
BEGIN
  -- Drop any existing INSERT policy
  DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
  
  -- Create INSERT policy for profiles
  CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
END $$;

-- Ensure UPDATE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Manually insert profile for existing user if needed
-- Replace YOUR_USER_ID and YOUR_EMAIL with your actual values from Supabase Auth
-- You can find these in Supabase Dashboard > Authentication > Users

-- Example (uncomment and modify with your details):
-- INSERT INTO profiles (id, email, full_name)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   'your-email@example.com',
--   'Your Name'
-- )
-- ON CONFLICT (id) DO UPDATE
-- SET email = EXCLUDED.email,
--     full_name = EXCLUDED.full_name;

-- Verify policies are correct
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;