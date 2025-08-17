-- Create Storage Bucket for Invoice Attachments (Safe Version)
-- This script creates the storage bucket needed for file uploads
-- It safely handles existing policies by dropping them first

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-attachments',
  'invoice-attachments', 
  true, -- Public bucket for easier access (RLS will still apply)
  false, -- No AVIF auto-detection
  10485760, -- 10MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view invoice attachments in their tents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload invoice attachments in their tents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own invoice attachments" ON storage.objects;

-- Create RLS policies for the storage bucket
-- Allow authenticated users to view files in their tent's invoices
CREATE POLICY "Users can view invoice attachments in their tents"
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

-- Allow authenticated users to upload files to invoices in their tents
CREATE POLICY "Users can upload invoice attachments in their tents"
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

-- Allow users to delete their own uploaded files
CREATE POLICY "Users can delete their own invoice attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoice-attachments' AND
  auth.uid() IN (
    SELECT uploaded_by 
    FROM invoice_attachments
    WHERE storage_path = name
  )
);

-- Grant necessary permissions (safe to run multiple times)
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Storage bucket for invoice attachments created/updated successfully!';
END $$;