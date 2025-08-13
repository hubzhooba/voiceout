import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './dashboard-content'

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ workspace?: string; new?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch profile with error handling
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
            <li>Copy the contents of <code className="bg-muted px-2 py-1 rounded">supabase/schema.sql</code></li>
            <li>Paste and run the SQL</li>
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

  // Fetch all workspaces user belongs to
  const { data: workspaceMembers } = await supabase
    .from('workspace_members')
    .select(`
      role,
      primary_role,
      workspace_id,
      workspace:workspace_id (*)
    `)
    .eq('user_id', user.id)

  interface WorkspaceData {
    id: string
    name: string
    description: string | null
    owner_id: string
    business_address: string | null
    business_tin: string | null
    default_withholding_tax: number
    invoice_prefix: string | null
    invoice_notes: string | null
    created_at: string
    updated_at: string
  }
  
  let workspaces: WorkspaceData[] = []
  
  if (workspaceMembers) {
    workspaces = workspaceMembers
      .map(wm => {
        // Handle the case where workspace might be an array due to incorrect relation
        const workspace = Array.isArray(wm.workspace) ? wm.workspace[0] : wm.workspace
        return workspace as WorkspaceData
      })
      .filter((w): w is WorkspaceData => w !== null && typeof w === 'object' && 'id' in w)
  }
  
  // If join didn't work, fetch workspaces directly
  if (workspaceMembers && workspaceMembers.length > 0 && workspaces.length === 0) {
    const workspaceIds = workspaceMembers.map(wm => wm.workspace_id).filter(Boolean)
    if (workspaceIds.length > 0) {
      const { data: directWorkspaces } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
      
      workspaces = directWorkspaces || []
    }
  }
  
  // Also check owned workspaces
  const { data: ownedWorkspaces } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
  
  if (ownedWorkspaces) {
    ownedWorkspaces.forEach(ow => {
      if (!workspaces.find(w => w.id === ow.id)) {
        workspaces.push(ow)
      }
    })
  }

  // If no workspaces, redirect to workspace selector
  if (workspaces.length === 0) {
    redirect('/workspaces')
  }

  // If specific workspace requested, validate it exists
  let selectedWorkspaceId = params.workspace
  if (selectedWorkspaceId) {
    const workspaceExists = workspaces.some(w => w.id === selectedWorkspaceId)
    if (!workspaceExists) {
      redirect('/workspaces')
    }
  } else {
    // No workspace specified, use first one or redirect to selector
    if (workspaces.length === 1) {
      selectedWorkspaceId = workspaces[0].id
    } else {
      redirect('/workspaces')
    }
  }

  return (
    <DashboardContent 
      user={user} 
      profile={profile}
      workspaces={workspaces}
      selectedWorkspaceId={selectedWorkspaceId}
      isNewWorkspace={params.new === 'true'}
    />
  )
}