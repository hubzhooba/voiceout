# Migration Instructions for File Upload Fix

## Issue Fixed
1. Invoice details page now properly displays complete project information including items, price, quantity, and WHT% breakdown
2. Fixed "StorageApiError: Bucket not found" error when uploading files

## Changes Made

### 1. Invoice Details Display
The invoice details page (`/components/invoice/optimized-invoice-view.tsx`) already displays:
- Full items table with description, quantity, unit price, and amount
- Tax and withholding tax breakdown with percentages
- Subtotal and total calculations

### 2. File Upload Fix
Removed client-side bucket creation attempts from:
- `/components/project/invoice-upload-modal.tsx`
- `/components/project/project-attachments.tsx`

### 3. Database Migration Required
Run the following SQL migration in your Supabase dashboard SQL editor:

```sql
-- File: /supabase/migrations/008_ensure_project_files_bucket.sql
-- This ensures the project-files storage bucket exists with proper configuration

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
```

## Steps to Apply

1. **Apply the database migration:**
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Copy and paste the SQL from `/supabase/migrations/008_ensure_project_files_bucket.sql`
   - Run the query

2. **Deploy the code changes:**
   - The code changes have already been made to the components
   - Deploy your application normally

3. **Test the fixes:**
   - Navigate to any invoice details page to verify all information displays correctly
   - Test file upload functionality on projects to ensure it works without errors

## Note
The client-side code no longer attempts to create storage buckets, which requires admin privileges. Instead, the bucket is created via SQL migration which has the proper permissions.