-- Fix the auth trigger to ensure profiles are created
-- Run this in Supabase SQL Editor

-- 1. First run the emergency fix to allow profile creation
DROP POLICY IF EXISTS "Allow all reads" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON profiles;
DROP POLICY IF EXISTS "Allow updates to own profile" ON profiles;

-- 2. Create policies that don't rely on auth.uid() for now
CREATE POLICY "Public profiles read"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Public profiles insert"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public profiles update"
  ON profiles FOR UPDATE
  USING (true);

-- 3. Create or replace the trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- 4. Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;

-- 6. Test by checking existing users
SELECT 
  au.id,
  au.email,
  p.id as profile_id,
  p.email as profile_email
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id;

-- If you see users without profiles, manually create them:
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  created_at,
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;