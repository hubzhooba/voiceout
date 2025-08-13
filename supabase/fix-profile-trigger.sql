-- Fix for "violates foreign key constraint" error
-- This creates profiles automatically when users sign up

-- Step 1: Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    now(),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Create profiles for any existing users who don't have one
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  created_at,
  updated_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Verify all users now have profiles
SELECT 
  'Users without profiles:' as check,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Step 5: Make sure the foreign key constraint references profiles, not auth.users
-- Check current constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'workspaces_owner_id_fkey';

-- If needed, recreate the constraint to reference profiles instead of auth.users
-- This is already correct in our schema, but just in case:
/*
ALTER TABLE public.workspaces 
  DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;

ALTER TABLE public.workspaces 
  ADD CONSTRAINT workspaces_owner_id_fkey 
  FOREIGN KEY (owner_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;
*/

SELECT 'Profile trigger created successfully! Try creating a workspace now.' as message;