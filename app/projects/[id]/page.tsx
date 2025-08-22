import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetailEnhanced } from './project-detail-enhanced'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    notFound()
  }

  // Fetch project with all related data including workflow fields
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      workflow_step,
      step1_status,
      step1_completed_at,
      step1_completed_by,
      step2_status,
      step2_approved_at,
      step2_approved_by,
      step3_status,
      step3_requested_at,
      step3_requested_by,
      step4_status,
      step4_uploaded_at,
      step4_uploaded_by,
      step5_status,
      step5_accepted_at,
      step5_accepted_by,
      invoice_file_url,
      invoice_file_name,
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

  return <ProjectDetailEnhanced 
    project={project} 
    currentUserId={user.id}
    userRole={userMember.tent_role || 'client'}
    isAdmin={userMember.is_admin || false}
  />
}