# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceOut (CreatorTent) is an invoice management platform built with Next.js 15, TypeScript, and Supabase. It uses a "tent" system for two-party invoice collaboration between creators and clients, featuring glassmorphism UI design.

## Tech Stack

- **Frontend**: Next.js 15.4.6 with App Router, TypeScript 5, React 19.1.0
- **Styling**: Tailwind CSS with glassmorphism design system
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with RLS policies
- **State Management**: React Hook Form, TanStack Query
- **File Storage**: Supabase Storage

## Development Commands

```bash
# Install dependencies
npm install

# Run development server with Turbopack
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run linting
npm run lint

# Docker commands
npm run docker:build
npm run docker:run

# Deployment
npm run deploy:vercel
npm run deploy:railway
```

## Database Architecture

The application has migrated from workspaces to a tent-based system. Key tables:
- `profiles`: User profiles (extends auth.users)
- `tents`: Two-party collaboration spaces (replaces workspaces)
- `tent_members`: Membership with admin/client roles
- `tent_invoices`: Invoices within tents
- `tent_messages`: Communication within tents
- `tent_documents`: Shared documents

**Note**: The codebase is in transition - some files still reference old workspace/room concepts. When fixing bugs or adding features, use the tent-based system.

## Key Architectural Patterns

### Authentication Flow
- Middleware at `/middleware.ts` handles auth checks
- Supabase client setup in `/lib/supabase/client.ts` (client-side) and `/lib/supabase/server.ts` (server-side)
- Protected routes require authentication

### API Routes
Located in `/app/api/`:
- `/tents/create`: Create new tent
- `/tents/join`: Join tent via invite code
- `/invitations/send`: Send tent invitations

### Component Structure
- UI primitives in `/components/ui/` (Shadcn components)
- Feature components in `/components/` organized by domain
- Glassmorphism styling using CSS classes: `glass-card`, `glass-panel`, `glass-morphism`

### Database Migrations
- Migration files in `/supabase/migrations/` numbered sequentially
- Latest schema focuses on tent-based system
- Run migrations via Supabase dashboard SQL editor

## Important Considerations

1. **Tent System**: The app uses a two-party tent system where one user is admin and another is client. Max 2 members per tent.

2. **RLS Policies**: All database tables have Row Level Security enabled. Users can only access data in tents they belong to.

3. **Real-time Features**: Uses Supabase real-time subscriptions for notifications and messages.

4. **File Uploads**: Documents and scanned invoices stored in Supabase Storage buckets.

5. **Invoice Workflow**: 
   - Status flow: draft → submitted → processing → completed/rejected
   - Managers can upload scanned copies for users

## Environment Setup

Required environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing Approach

No test framework is currently configured. When adding tests:
1. Check for existing test setup first
2. Consider adding Jest + React Testing Library for component tests
3. Use Playwright for E2E tests if needed

## Common Patterns

- Forms use React Hook Form with Zod validation
- API calls use server actions or API routes with Supabase client
- Error handling with toast notifications
- Loading states with skeleton components
- Responsive design with mobile-first approach