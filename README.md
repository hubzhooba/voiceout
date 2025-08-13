# VoiceOut - Invoice Management System

A modern invoice management application built with Next.js, TypeScript, and Supabase that allows users to create, manage, and track service invoices with workspace collaboration features.

## Features

- **User Authentication**: Secure login and signup with Supabase Auth
- **Workspace Management**: Create and manage multiple workspaces for different businesses/teams
- **Invoice Creation**: Comprehensive invoice form with line items, tax calculations, and client details
- **Role-Based Access**: User, Manager, and Admin roles with different permissions
- **Real-time Notifications**: Managers get notified when new invoices are submitted
- **Invoice Workflow**: Draft → Submitted → Processing → Completed workflow
- **File Upload**: Managers can upload scanned invoices for users to send out
- **Dashboard Views**: Different views for users and managers
- **Future Features**: Cash Receipt Book logging

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **UI Components**: Shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **File Storage**: Supabase Storage

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### 2. Clone and Install

```bash
cd voiceout
npm install
```

### 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Go to your Supabase project dashboard and navigate to the SQL Editor

3. Run the database schema script located in `supabase/schema.sql`

4. Get your Supabase credentials:
   - Go to Settings → API
   - Copy your Project URL and anon public key

### 4. Environment Variables

Create a `.env.local` file in the root directory and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

1. **Sign Up**: Create a new account with your email and password
2. **Create Workspace**: After login, create your first workspace
3. **Create Invoice**: Click "New Invoice" to create your first invoice
4. **Submit for Processing**: Submit invoices for manager review
5. **Manager Actions**: Managers can view submitted invoices and upload scanned copies

## Project Structure

```
voiceout/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── invoice-form.tsx  # Invoice creation form
├── lib/                   # Utilities and configuration
│   └── supabase/         # Supabase client setup
├── types/                 # TypeScript type definitions
└── supabase/             # Database schema
```

## Database Schema

The application uses the following main tables:
- `profiles`: User profiles
- `workspaces`: Business workspaces
- `workspace_members`: Workspace membership and roles
- `invoices`: Invoice records
- `invoice_items`: Line items for invoices
- `notifications`: User notifications
- `workspace_invitations`: Pending workspace invites
- `cash_receipts`: Cash receipt book entries (future feature)

## Security

- Row Level Security (RLS) policies ensure users can only access their own data
- Workspace-based data isolation
- Role-based permissions (User, Manager, Admin)

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT