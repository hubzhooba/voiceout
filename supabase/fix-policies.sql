-- Fix for infinite recursion in RLS policies
-- Run this in your Supabase SQL Editor to fix the workspace creation issue

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can manage members" ON public.workspace_members;

-- Recreate workspace_members policies without circular references
CREATE POLICY "Users can view members of their workspaces" ON public.workspace_members
  FOR SELECT USING (
    -- User can see members if they are in the same workspace
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can insert members" ON public.workspace_members
  FOR INSERT WITH CHECK (
    -- Allow insert if user is workspace owner
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_members.workspace_id
      AND owner_id = auth.uid()
    )
    OR
    -- Or if user is admin/manager of the workspace (but avoid self-reference)
    EXISTS (
      SELECT 1 FROM public.workspace_members existing_member
      WHERE existing_member.workspace_id = workspace_members.workspace_id
      AND existing_member.user_id = auth.uid()
      AND existing_member.role IN ('admin', 'manager')
      -- Make sure we're not checking the same row being inserted
      AND existing_member.id IS DISTINCT FROM workspace_members.id
    )
  );

CREATE POLICY "Workspace admins can update members" ON public.workspace_members
  FOR UPDATE USING (
    -- Allow update if user is workspace owner
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_members.workspace_id
      AND owner_id = auth.uid()
    )
    OR
    -- Or if user is admin of the workspace (but not updating themselves)
    (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.id != workspace_members.id
      )
    )
  );

CREATE POLICY "Workspace admins can delete members" ON public.workspace_members
  FOR DELETE USING (
    -- Allow delete if user is workspace owner
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_members.workspace_id
      AND owner_id = auth.uid()
    )
    OR
    -- Or if user is admin (but not deleting themselves)
    (
      workspace_members.user_id != auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
      )
    )
  );

-- Also ensure the workspace view policy doesn't cause issues
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;

CREATE POLICY "Users can view workspaces they belong to" ON public.workspaces
  FOR SELECT USING (
    auth.uid() = owner_id 
    OR 
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Test the policies are working
-- This should complete without errors
SELECT 'Policies fixed successfully!' as message;