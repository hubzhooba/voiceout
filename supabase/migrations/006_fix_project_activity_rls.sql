-- Fix RLS policies for project_activity table
-- This migration fixes the Row Level Security policy that was preventing activity logs from being created

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view activity" ON project_activity;

-- Create new policies for project_activity
-- Users can view activity logs for projects in their tents
CREATE POLICY "Users can view project activity" ON project_activity
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can create activity logs for projects in their tents
CREATE POLICY "Users can create project activity" ON project_activity
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Also fix the projects table policies to ensure they work correctly
DROP POLICY IF EXISTS "Users can view projects in their tents" ON projects;
DROP POLICY IF EXISTS "Users can create projects in their tents" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;

-- Recreate projects policies with better permissions
CREATE POLICY "Users can view projects in their tents" ON projects
  FOR SELECT USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects in their tents" ON projects
  FOR INSERT WITH CHECK (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects in their tents" ON projects
  FOR UPDATE USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

-- Fix project_items policies
DROP POLICY IF EXISTS "Users can view project items" ON project_items;
DROP POLICY IF EXISTS "Users can manage project items" ON project_items;

CREATE POLICY "Users can view project items" ON project_items
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create project items" ON project_items
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update project items" ON project_items
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete project items" ON project_items
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Ensure all tables have RLS enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;