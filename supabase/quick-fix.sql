-- QUICK FIX for workspace creation error
-- Run this immediately in your Supabase SQL Editor

-- Temporarily disable RLS to fix the immediate issue
ALTER TABLE public.workspace_members DISABLE ROW LEVEL SECURITY;

-- After running this, try creating a workspace again
-- It should work now

-- Optional: Re-enable RLS with fixed policies later
-- You can run the fix-policies.sql file after this works