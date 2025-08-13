# Supabase Database Setup Instructions

## Quick Setup

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ivictnlwwogzxphhhlnh

2. Navigate to the SQL Editor (left sidebar)

3. Copy and paste the entire contents of `schema.sql` into the SQL editor

4. Click "Run" to execute the SQL and create all tables

## Alternative: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
npx supabase db push --db-url "postgresql://postgres:[YOUR-DB-PASSWORD]@db.ivictnlwwogzxphhhlnh.supabase.co:5432/postgres"
```

## Verify Tables Created

After running the schema, you should have these tables:
- profiles
- workspaces
- workspace_members
- invoices
- invoice_items
- notifications
- workspace_invitations
- cash_receipts

## Enable Storage (for file uploads)

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called "documents"
3. Set it to private (authenticated users only)

## Authentication Setup

1. Go to Authentication → Providers
2. Ensure Email provider is enabled
3. Optionally configure email templates

## Troubleshooting

If you get errors:
- Make sure you're connected to the correct project
- Check that UUID extension is enabled (should be by default)
- Ensure you have the correct permissions