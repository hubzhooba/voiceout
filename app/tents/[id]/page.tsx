import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TentView } from './tent-view'

// Force dynamic rendering to avoid build-time Supabase errors
export const dynamic = 'force-dynamic'

export default async function TentPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is a member of this tent
  const { data: member } = await supabase
    .from('tent_members')
    .select('*')
    .eq('tent_id', id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/dashboard')
  }

  // Fetch tent details with members
  const { data: tent } = await supabase
    .from('tents')
    .select(`
      *,
      tent_members (
        *,
        profiles (
          id,
          full_name,
          email
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!tent) {
    redirect('/dashboard')
  }

  return <TentView tent={tent} currentUserId={user.id} />
}