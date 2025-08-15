import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoomWorkspaceView } from '@/components/room-workspace/room-workspace-view'

export default async function RoomPage({
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

  // Check if user has access to this room
  const { data: participant } = await supabase
    .from('room_participants')
    .select('*')
    .eq('room_id', id)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    redirect('/dashboard')
  }

  // Fetch room details with enhanced fields
  const { data: room } = await supabase
    .from('collaboration_rooms')
    .select(`
      *,
      room_participants (
        user_id,
        role,
        workflow_role,
        profiles (
          id,
          email,
          full_name
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!room) {
    redirect('/dashboard')
  }

  return <RoomWorkspaceView room={room} currentUserId={user.id} />
}