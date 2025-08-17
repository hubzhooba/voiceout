# Fix Storage Bucket Migration

## Issue
The original storage bucket migration script fails because the policies already exist in your database.

## Solution
Use the fixed migration script: `supabase/migrations/003_create_storage_buckets_fixed.sql`

This script:
1. **Drops existing policies first** using `DROP POLICY IF EXISTS`
2. **Creates new policies** with the correct permissions
3. **Updates the bucket configuration** if it already exists

## How to Apply

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `003_create_storage_buckets_fixed.sql`
4. Run the script

## What This Fixes

- ✅ Handles existing policies gracefully
- ✅ Updates bucket configuration without errors
- ✅ Ensures proper RLS policies are in place
- ✅ Sets correct file size limits (10MB)
- ✅ Configures allowed MIME types

## Alternative: Clean Slate Approach

If you want to completely reset the storage bucket:

```sql
-- 1. First, drop all existing policies
DROP POLICY IF EXISTS "Users can view invoice attachments in their tents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload invoice attachments in their tents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own invoice attachments" ON storage.objects;

-- 2. Then run the original script
-- (copy from 003_create_storage_buckets.sql starting from line 33)
```

## Verification

After running the script, verify:
1. Storage bucket exists: Check Storage section in Supabase
2. Policies are active: Check Authentication > Policies
3. Test file upload: Try uploading a file through the app