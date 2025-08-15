-- Create storage bucket for invoice attachments
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-attachments',
  'invoice-attachments',
  true, -- Public bucket for easier access
  false,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for storage
CREATE POLICY "Users can view attachments in their tents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-attachments' AND
    auth.uid() IN (
      SELECT tm.user_id 
      FROM tent_members tm
      JOIN invoices i ON i.tent_id = tm.tent_id
      WHERE i.id::text = SPLIT_PART(name, '/', 2)
    )
  );

CREATE POLICY "Users can upload attachments to their tent invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-attachments' AND
    auth.uid() IN (
      SELECT tm.user_id 
      FROM tent_members tm
      JOIN invoices i ON i.tent_id = tm.tent_id
      WHERE i.id::text = SPLIT_PART(name, '/', 2)
    )
  );

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoice-attachments' AND
    auth.uid() = owner
  );