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
  const { data: workspaceMembers, error: membersError } = await supabase
    .from('workspace_members')
    .select(`
      role,
      primary_role,
      workspace_id,
      workspace:workspace_id (
        id,
        name,
        description,
        owner_id,
        created_at
      )
    `)
    .eq('user_id', user.id)

  console.log('Workspace members query result:', workspaceMembers, 'Error:', membersError)

  // Alternative: fetch workspaces directly if the join doesn't work
  let workspaces = []
  
  if (workspaceMembers && workspaceMembers.length > 0) {
    // Try to use the joined data first
    workspaces = workspaceMembers
      .filter(wm => wm.workspace)
      .map(wm => ({
        ...wm.workspace,
        userRole: wm.role,
        primaryRole: wm.primary_role
      }))
    
    // If no workspaces from join, fetch directly
    if (workspaces.length === 0) {
      const workspaceIds = workspaceMembers.map(wm => wm.workspace_id).filter(Boolean)
      if (workspaceIds.length > 0) {
        const { data: directWorkspaces } = await supabase
          .from('workspaces')
          .select('*')
          .in('id', workspaceIds)
        
        if (directWorkspaces) {
          workspaces = directWorkspaces.map(w => {
            const member = workspaceMembers.find(wm => wm.workspace_id === w.id)
            return {
              ...w,
              userRole: member?.role || 'user',
              primaryRole: member?.primary_role || null
            }
          })
        }
      }
    }
  }

  // Also check if user owns any workspaces directly
  const { data: ownedWorkspaces } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)

  if (ownedWorkspaces && ownedWorkspaces.length > 0) {
    ownedWorkspaces.forEach(ow => {
      if (!workspaces.find(w => w.id === ow.id)) {
        workspaces.push({
          ...ow,
          userRole: 'admin',
          primaryRole: 'admin'
        })
      }
    })
  }

  return (
    <WorkspaceSelector 
      user={user}
      profile={profile}
      workspaces={workspaces}
    />
  )
}