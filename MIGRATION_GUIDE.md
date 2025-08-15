# CreatorTent Migration Guide

## Overview
This guide walks through the process of converting your existing VoiceOut application with room system to the new CreatorTent system with tents.

## Database Migration Steps

### 1. Check Current Database State
First, run this query to see what tables exist:
```sql
-- Run: supabase/migrations/001_check_existing.sql
```

### 2. Run the Safe Migration Script
The safe migration script handles your existing room tables and converts them to tents:
```sql
-- Run: supabase/migrations/007_safe_rooms_to_tents_conversion.sql
```

This migration will:
- Rename all room tables to tent tables
- Add new columns for the CreatorTent system
- Update all policies and indexes
- Preserve existing data

## Application Structure

### New Files Created
1. **Tent Components**
   - `/components/tents/tents-list.tsx` - Lists all tents
   - `/components/tents/create-tent-dialog.tsx` - Dialog for creating new tents
   - `/components/invoice-list.tsx` - Invoice list for tents

2. **Tent Pages**
   - `/app/tents/[id]/page.tsx` - Tent detail page
   - `/app/tents/[id]/tent-view.tsx` - Main tent view component
   - `/app/tents/[id]/tent-members.tsx` - Manage tent members
   - `/app/tents/[id]/tent-settings.tsx` - Tent settings
   - `/app/tents/join/[code]/page.tsx` - Join tent page
   - `/app/tents/join/[code]/join-tent-view.tsx` - Join tent UI

3. **API Routes**
   - `/app/api/tents/create/route.ts` - Create new tent
   - `/app/api/tents/join/route.ts` - Join existing tent

### Updated Files
- `/app/dashboard/dashboard-content.tsx` - Added Tents tab
- `/components/invoice-form-enhanced.tsx` - Updated to work with tents
- `/package.json` - Updated app name to "creatortent"

## How Tents Work

### Role System
- **Creator chooses their role**: When creating a tent, the creator selects either "client" or "manager"
- **Automatic opposite role**: The invited user automatically gets the opposite role
- **Admin privileges**: The tent creator is always the admin with full management rights

### Two-Party Limit
- Each tent allows exactly 2 members
- Once 2 members join, the tent is automatically locked
- Only the admin can manage tent settings and invitations

### Workflow
1. **Client Role**: Can create and submit invoices
2. **Manager Role**: Can review, approve, or reject invoices
3. **Admin**: Can manage all tent settings (creator only)

## Testing the Migration

### 1. Run Database Migration
```bash
# In Supabase SQL Editor, run:
supabase/migrations/007_safe_rooms_to_tents_conversion.sql
```

### 2. Test Tent Creation
1. Go to Dashboard → Tents tab
2. Click "Create Tent"
3. Choose your role (client/manager)
4. Copy the invite code

### 3. Test Joining a Tent
1. Share the invite code with another user
2. They navigate to `/tents/join/[CODE]`
3. They automatically get the opposite role

### 4. Test Invoice Workflow
1. Client creates invoice in tent
2. Manager reviews and approves/rejects
3. Both parties see real-time updates

## Deployment

### Environment Variables
Ensure these are set in Railway/Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=your_app_url
```

### Build Commands
```bash
npm run build
npm start
```

## Troubleshooting

### Migration Errors
If you get "relation already exists" errors:
1. The tables might already be renamed
2. Run the migration in a transaction
3. Check existing tables first with query 001

### Missing UI Components
If components are missing:
```bash
npm install @radix-ui/react-avatar @radix-ui/react-scroll-area @radix-ui/react-radio-group
```

### Build Errors
Ensure all TypeScript errors are resolved:
```bash
npm run build
```

## Next Steps
1. Run the migration script in Supabase
2. Test tent creation and invitation flow
3. Deploy to Railway/Vercel
4. Monitor for any issues

## Support
For issues, check:
- Supabase logs for database errors
- Browser console for client-side errors
- Railway/Vercel logs for deployment issues