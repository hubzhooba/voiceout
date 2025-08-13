# Deployment Guide for VoiceOut

This guide covers deploying the VoiceOut invoice management application to Vercel and Railway.

## Prerequisites

1. A Supabase project with the database schema set up
2. Environment variables from your Supabase project
3. Either a Vercel or Railway account (or both)

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deploying to Vercel

### Option 1: One-Click Deploy (Recommended)

1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy"

### Option 2: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts and add environment variables when asked
```

### Post-Deployment

1. Add your Vercel domain to Supabase Auth settings:
   - Go to Supabase Dashboard > Authentication > URL Configuration
   - Add your Vercel URL to "Redirect URLs": `https://your-app.vercel.app/*`

## Deploying to Railway

### Option 1: Deploy from GitHub

1. Push your code to GitHub
2. Visit [railway.app](https://railway.app)
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Add environment variables in Railway dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `PORT` = 3000 (Railway will auto-assign if not specified)
7. Railway will automatically deploy

### Option 2: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Add environment variables
railway variables set NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Deploy
railway up
```

### Post-Deployment

1. Get your Railway domain:
   - Go to your Railway project settings
   - Generate a domain or use a custom domain
2. Add Railway domain to Supabase Auth settings:
   - Go to Supabase Dashboard > Authentication > URL Configuration
   - Add your Railway URL to "Redirect URLs": `https://your-app.railway.app/*`

## Database Setup

Before deploying, ensure your Supabase database is properly configured:

1. Run all SQL migrations in the `supabase/` folder:
   - `schema.sql` - Base schema
   - `fix-policies.sql` - RLS policies
   - `complete-migration.sql` - Additional columns
   - `fix-invitations-table.sql` - Invitations table
   - `add-workspace-settings.sql` - Workspace settings

2. Enable Row Level Security (RLS) on all tables

3. Configure Auth settings:
   - Enable Email auth
   - Set up email templates if needed
   - Configure redirect URLs

## Production Considerations

### Performance Optimization

1. **Image Optimization**: The app uses Next.js Image component for optimization
2. **Database Indexes**: Ensure proper indexes are created (included in migrations)
3. **Caching**: Consider implementing Redis for session management if needed

### Security

1. **Environment Variables**: Never commit `.env.local` to git
2. **RLS Policies**: Always ensure Row Level Security is enabled
3. **API Keys**: Use server-side API routes for sensitive operations
4. **CORS**: Configure CORS settings in Supabase for your production domains

### Monitoring

1. **Vercel Analytics**: Enable in Vercel dashboard
2. **Railway Metrics**: Available in Railway dashboard
3. **Supabase Logs**: Monitor database and auth logs in Supabase dashboard
4. **Error Tracking**: Consider adding Sentry or similar error tracking

## Troubleshooting

### Common Issues

1. **"Relation does not exist" error**
   - Run all SQL migrations in order
   - Check that all tables are created

2. **Authentication not working**
   - Verify redirect URLs in Supabase
   - Check environment variables are set correctly
   - Ensure cookies are enabled for auth

3. **Build failures**
   - Check Node.js version (requires 18.x or higher)
   - Verify all dependencies are installed
   - Check for TypeScript errors: `npm run build` locally

4. **Database connection issues**
   - Verify Supabase URL and anon key
   - Check RLS policies aren't blocking access
   - Ensure database is not paused (free tier)

## Support

For deployment issues:
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Railway: [docs.railway.app](https://docs.railway.app)
- Supabase: [supabase.com/docs](https://supabase.com/docs)

For application issues:
- Check the GitHub repository issues
- Review the README.md for setup instructions