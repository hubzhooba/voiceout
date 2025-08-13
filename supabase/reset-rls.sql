-- Complete RLS Reset and Fix
-- This will disable RLS entirely to get your app working
-- Run this in Supabase SQL Editor

-- STEP 1: Disable RLS on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_receipts DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop all existing policies to start fresh
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- STEP 3: Create minimal working policies (optional - only if you want some security)
-- These are very permissive but won't cause recursion

-- Allow authenticated users to do everything with profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can do everything with profiles" ON public.profiles
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with workspaces" ON public.workspaces
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with workspace_members" ON public.workspace_members
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with invoices" ON public.invoices
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with invoice_items" ON public.invoice_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with notifications" ON public.notifications
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with workspace_invitations
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with workspace_invitations" ON public.workspace_invitations
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to do everything with cash_receipts
ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything with cash_receipts" ON public.cash_receipts
  FOR ALL USING (auth.uid() IS NOT NULL);

-- DONE! Your app should work now
SELECT 'RLS policies have been reset. Try creating a workspace now!' as message;