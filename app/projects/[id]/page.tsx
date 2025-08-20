import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetailView } from './project-detail-view'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
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
      project_comments (
        id,
        comment,
        is_internal,
        created_at,
        user_id,
        profiles!project_comments_user_id_fkey (
          full_name,
          email
        )
      ),
      project_activity (
        id,
        activity_type,
        description,
        created_at,
        user_id,
        profiles!project_activity_user_id_fkey (
          full_name,
          email
        )
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

  // Check if user has access to this project
  const userMember = project.tents?.tent_members?.find(
    (member: { user_id: string; tent_role: string; is_admin: boolean }) => member.user_id === user.id
  )

  if (!userMember) {
    notFound()
  }

  return <ProjectDetailView 
    project={project} 
    currentUserId={user.id}
    userRole={userMember.tent_role || 'client'}
    isAdmin={userMember.is_admin || false}
  />
}