-- Add DELETE policy for projects table
-- This allows users to delete projects in their tents

-- Drop any existing delete policy (in case it exists)
DROP POLICY IF EXISTS "Users can delete projects in their tents" ON projects;

-- Create policy allowing users to delete projects in their tents
CREATE POLICY "Users can delete projects in their tents" ON projects
  FOR DELETE USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

-- Also ensure project_items and project_tasks have proper delete policies if tables exist
DO $$ 
BEGIN
  -- Check if project_tasks table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
    DROP POLICY IF EXISTS "Users can delete project tasks" ON project_tasks;
    CREATE POLICY "Users can delete project tasks" ON project_tasks
      FOR DELETE USING (
        project_id IN (
          SELECT id FROM projects WHERE tent_id IN (
            SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;

  -- Update foreign key constraints for existing tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_items') THEN
    ALTER TABLE project_items 
      DROP CONSTRAINT IF EXISTS project_items_project_id_fkey,
      ADD CONSTRAINT project_items_project_id_fkey 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
    ALTER TABLE project_tasks 
      DROP CONSTRAINT IF EXISTS project_tasks_project_id_fkey,
      ADD CONSTRAINT project_tasks_project_id_fkey 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_activity') THEN
    ALTER TABLE project_activity 
      DROP CONSTRAINT IF EXISTS project_activity_project_id_fkey,
      ADD CONSTRAINT project_activity_project_id_fkey 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_attachments') THEN
    ALTER TABLE project_attachments 
      DROP CONSTRAINT IF EXISTS project_attachments_project_id_fkey,
      ADD CONSTRAINT project_attachments_project_id_fkey 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE;
  END IF;
END $$;