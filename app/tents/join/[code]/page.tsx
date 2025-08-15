import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JoinTentView } from './join-tent-view'

export default async function JoinTentPage({ 
  params 
}: { 
  params: Promise<{ code: string }> 
}) {
  const { code } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch tent by invite code
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
    .eq('invite_code', code.toUpperCase())
    .single()

  if (!tent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite Code</h1>
          <p className="text-muted-foreground mb-6">
            The invite code you entered is invalid or has expired.
          </p>
          <a 
            href="/dashboard"
            className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  // Check if user is already a member
  interface TentMember {
    user_id: string
  }
  
  const isAlreadyMember = tent.tent_members?.some((m: TentMember) => m.user_id === user.id)
  
  if (isAlreadyMember) {
    redirect(`/tents/${tent.id}`)
  }

  // Check if tent is full
  if (tent.is_locked || tent.tent_members?.length >= 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Tent is Full</h1>
          <p className="text-muted-foreground mb-6">
            This tent already has 2 members and cannot accept more participants.
          </p>
          <a 
            href="/dashboard"
            className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return <JoinTentView tent={tent} userId={user.id} />
}