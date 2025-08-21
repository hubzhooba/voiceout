-- Create storage bucket for project files
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
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for project-files bucket
DROP POLICY IF EXISTS "Users can view files in their tent's projects" ON storage.objects;
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

DROP POLICY IF EXISTS "Managers can upload files to projects" ON storage.objects;
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

DROP POLICY IF EXISTS "Managers can delete files from projects" ON storage.objects;
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

-- RLS policies for project_attachments table
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments in their tent's projects" ON project_attachments;
CREATE POLICY "Users can view attachments in their tent's projects"
  ON project_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN tent_members tm ON tm.tent_id = p.tent_id
      WHERE p.id = project_attachments.project_id
      AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can insert attachments" ON project_attachments;
CREATE POLICY "Managers can insert attachments"
  ON project_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN tent_members tm ON tm.tent_id = p.tent_id
      WHERE p.id = project_attachments.project_id
      AND tm.user_id = auth.uid()
      AND (tm.tent_role = 'manager' OR tm.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "Managers can delete attachments" ON project_attachments;
CREATE POLICY "Managers can delete attachments"
  ON project_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN tent_members tm ON tm.tent_id = p.tent_id
      WHERE p.id = project_attachments.project_id
      AND tm.user_id = auth.uid()
      AND (tm.tent_role = 'manager' OR tm.is_admin = true)
    )
  );

-- Grant permissions
GRANT ALL ON project_attachments TO authenticated;