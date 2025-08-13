import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceSelector } from './workspace-selector'

export default async function WorkspacesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch all workspaces the user belongs to
  const { data: workspaceMembers } = await supabase
    .from('workspace_members')
    .select(`
      role,
      primary_role,
      workspace:workspaces (
        id,
        name,
        description,
        owner_id,
        created_at
      )
    `)
    .eq('user_id', user.id)

  const workspaces = workspaceMembers?.map(wm => ({
    ...wm.workspace,
    userRole: wm.role,
    primaryRole: wm.primary_role
  })) || []

  return (
    <WorkspaceSelector 
      user={user}
      profile={profile}
      workspaces={workspaces}
    />
  )
}