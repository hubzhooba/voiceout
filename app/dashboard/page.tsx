import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TentDashboard } from './tent-dashboard'

// Force dynamic rendering to avoid build-time Supabase errors
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If profile table doesn't exist, show setup instructions
  if (profileError?.message?.includes('relation') || profileError?.message?.includes('does not exist')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl bg-card rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4">Database Setup Required</h1>
          <p className="mb-4">The database tables haven&apos;t been created yet. Please follow these steps:</p>
          <ol className="list-decimal list-inside space-y-2 mb-6">
            <li>Go to your Supabase Dashboard</li>
            <li>Navigate to the SQL Editor</li>
            <li>Run the migration scripts in the supabase/migrations folder</li>
            <li>Refresh this page</li>
          </ol>
          <a 
            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
          >
            Open Supabase Dashboard
          </a>
        </div>
      </div>
    )
  }

  return <TentDashboard user={user} profile={profile} />
}