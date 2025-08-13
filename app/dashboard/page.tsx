import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select(`
      *,
      workspace_members!inner(*)
    `)
    .eq('workspace_members.user_id', user.id)

  return (
    <DashboardContent 
      user={user} 
      profile={profile}
      workspaces={workspaces || []}
    />
  )
}