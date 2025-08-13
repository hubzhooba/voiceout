# 🚨 IMPORTANT: Database Migration Required

You're getting the error because your Supabase database doesn't have the new columns yet. Follow these steps to fix it:

## Quick Fix Instructions

### Step 1: Open Supabase Dashboard
1. Go to your [Supabase Dashboard](https://ivictnlwwogzxphhhlnh.supabase.co)
2. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Migration
1. Click **New Query** button
2. Copy ALL contents from: `supabase/complete-migration.sql`
3. Paste it into the SQL Editor
4. Click **Run** button

### Step 3: Verify the Migration
After running the script, you should see:
- ✅ "Success" message in green
- ✅ "Migration completed successfully!" notice

### Step 4: Clear Browser Cache (if needed)
If you still see errors after migration:
1. Open Developer Tools (F12)
2. Go to Application/Storage tab
3. Clear Local Storage for your app
4. Refresh the page

## What This Migration Does

The migration adds these new fields to support the service invoice format:

### New Invoice Fields:
- `client_tin` - Tax Identification Number
- `is_cash_sale` - Boolean for cash/charge sale
- `withholding_tax` - Tax deduction amount
- `approved_at`, `approved_by` - Approval tracking
- `completed_at` - Completion timestamp
- `processing_notes` - Manager notes

### New Features:
- Invoice activity logging
- Approval workflow states
- Automatic status change tracking

## Troubleshooting

### If you get "column already exists" errors:
This is OK! It means some columns were already added. The script will continue.

### If you get permission errors:
Make sure you're using the service_role key or running as the database owner.

### If the app still shows errors after migration:
1. Wait 30 seconds for cache to clear
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. If still not working, restart your development server

## Alternative: Manual Column Addition

If the script doesn't work, you can add columns manually in Table Editor:

1. Go to **Table Editor** → **invoices** table
2. Click **Add column** and add:
   - `client_tin` (text, nullable)
   - `is_cash_sale` (boolean, default: true)
   - `withholding_tax` (numeric, default: 0)

## Need Help?

If you're still having issues:
1. Check the Supabase logs for errors
2. Verify the columns exist in Table Editor
3. Make sure your app is using the correct Supabase URL and anon key