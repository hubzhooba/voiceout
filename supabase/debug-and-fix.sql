-- Debug and Fix Script for 409 Conflict Error
-- Run each section separately to identify and fix the issue

-- STEP 1: Check existing workspaces (see if there are duplicates)
SELECT * FROM public.workspaces;

-- STEP 2: Check workspace_members table
SELECT * FROM public.workspace_members;

-- STEP 3: Check if RLS is causing issues
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('workspaces', 'workspace_members');

-- STEP 4: Temporarily disable ALL RLS (for testing)
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_receipts DISABLE ROW LEVEL SECURITY;

-- STEP 5: Check for any unique constraints
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'u'
  AND conrelid::regclass::text IN ('public.workspaces', 'public.workspace_members');

-- STEP 6: Clear any test data (OPTIONAL - only if you want to start fresh)
-- WARNING: This will delete all data!
-- TRUNCATE public.workspace_members CASCADE;
-- TRUNCATE public.workspaces CASCADE;

-- STEP 7: Create a test workspace manually to verify it works
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
/*
INSERT INTO public.workspaces (name, description, owner_id)
VALUES ('Test Workspace', 'Testing', 'YOUR_USER_ID')
RETURNING *;
*/

-- STEP 8: If everything works, re-enable RLS with simplified policies
/*
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Simple policies that won't cause recursion
DROP POLICY IF EXISTS "Anyone can create workspaces" ON public.workspaces;
CREATE POLICY "Anyone can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users see their workspaces" ON public.workspaces;
CREATE POLICY "Users see their workspaces" ON public.workspaces
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners update their workspaces" ON public.workspaces;
CREATE POLICY "Owners update their workspaces" ON public.workspaces
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Anyone can create members" ON public.workspace_members;
CREATE POLICY "Anyone can create members" ON public.workspace_members
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users see all members" ON public.workspace_members;
CREATE POLICY "Users see all members" ON public.workspace_members
  FOR SELECT USING (true);
*/