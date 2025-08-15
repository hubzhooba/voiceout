# Migration Instructions for VoiceOut

## Order of Migration Scripts

Please run these migration scripts in your Supabase SQL Editor in the following order:

### Step 1: Fix Existing Tables (Required)
Run `supabase/migrations/fix_existing_tables.sql`

This script will:
- Fix the tent_messages table (rename user_id to sender_id if needed)
- Add missing columns to existing tables
- Create missing tables
- Set up all RLS policies

### Step 2: Create Storage Bucket (Required for file uploads)
Run `supabase/migrations/003_create_storage_buckets.sql`

This script will:
- Create the `invoice-attachments` storage bucket
- Set up RLS policies for file access
- Configure file size limits and allowed mime types

## How to Apply Migrations

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the contents of each migration file
4. Paste and run them in order
5. Check for any errors in the output

## Alternative: Using Supabase CLI (if Docker is running)

```bash
# Start Docker Desktop first
# Then run:
npx supabase start
npx supabase db push
```

## Verification Steps

After running migrations:

1. Check if tables exist:
   - tent_messages
   - invoice_comments
   - invoice_attachments
   - invoice_revisions
   - audit_trail
   - invoice_signatures
   - sla_tracking

2. Test file upload by trying to attach a file to an invoice

3. Test messaging by sending a message in a tent

4. Verify that comments work on invoices

## Troubleshooting

If you encounter errors:

1. **"relation already exists"**: This is safe to ignore, the migration handles it
2. **"column does not exist"**: Run fix_existing_tables.sql again
3. **Storage bucket errors**: Make sure you have storage enabled in Supabase dashboard

## Features Enabled After Migration

✅ In-tent messaging/chat between client and manager
✅ Comments on specific invoices
✅ File attachments to invoices (receipts, contracts)
✅ PDF generation and download
✅ Digital signatures
✅ Invoice printing optimization
✅ Multi-level approval workflows
✅ Invoice revision history
✅ Audit trail of all changes
✅ Automated approval rules
✅ SLA tracking (time to approve)
✅ Enhanced performance with proper indexes