import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectEditView } from './project-edit-view'

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    notFound()
  }

  // Fetch project with all related data
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_items (
        id,
        item_type,
        description,
        quantity,
        unit_price,
        amount,
        status,
        due_date,
        completed_at
      ),
      project_tasks (
        id,
        title,
        description,
        status,
        priority,
        due_date,
        estimated_hours,
        actual_hours,
        completed_at,
        assigned_to
      ),
      tents!projects_tent_id_fkey (
        id,
        name,
        tent_members (
          user_id,
          tent_role,
          is_admin
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !project) {
    notFound()
  }

  // Check if user has permission to edit (members of the tent can edit)
  const userMember = project.tents?.tent_members?.find(
    (member: { user_id: string; tent_role: string; is_admin: boolean }) => member.user_id === user.id
  )

  if (!userMember) {
    notFound()
  }

  // For now, pass empty object for tentSettings since the relationship doesn't exist
  const tentSettings = {}

  return <ProjectEditView 
    project={project} 
    tentSettings={tentSettings}
    currentUserId={user.id}
    userRole={userMember.tent_role || 'client'}
    isAdmin={userMember.is_admin || false}
  />
}