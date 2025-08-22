-- Ensure project-files bucket exists with proper configuration
-- This migration handles the case where the bucket might not exist

-- First check and create the bucket if it doesn't exist
DO $$
BEGIN
  -- Check if bucket exists
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-files') THEN
    -- Create the bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'project-files',
      'project-files',
      true,
      10485760, -- 10MB
      ARRAY[
        'image/jpeg',
        'image/png', 
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    );
  END IF;
END $$;

-- Ensure RLS policies exist for the bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view files in their tent's projects" ON storage.objects;
DROP POLICY IF EXISTS "Managers can upload files to projects" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete files from projects" ON storage.objects;

-- Create policies for project-files bucket
CREATE POLICY "Users can view files in their tent's projects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files' AND
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN tent_members tm ON tm.tent_id = p.tent_id
      WHERE p.id::text = SPLIT_PART(name, '/', 1)
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can upload files to projects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files' AND
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN tent_members tm ON tm.tent_id = p.tent_id
      WHERE p.id::text = SPLIT_PART(name, '/', 1)
      AND tm.user_id = auth.uid()
      AND (tm.tent_role = 'manager' OR tm.is_admin = true)
    )
  );

CREATE POLICY "Managers can delete files from projects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files' AND
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN tent_members tm ON tm.tent_id = p.tent_id
      WHERE p.id::text = SPLIT_PART(name, '/', 1)
      AND tm.user_id = auth.uid()
      AND (tm.tent_role = 'manager' OR tm.is_admin = true)
    )
  );