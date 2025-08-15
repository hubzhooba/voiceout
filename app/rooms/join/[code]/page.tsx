import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JoinRoomPage } from './join-room-page'

export default async function JoinRoomByCodePage({
  params
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Store the invite code in the URL so they can join after login
    redirect(`/auth/login?invite=${code}`)
  }

  // Validate the invite code
  const { data: room } = await supabase
    .from('collaboration_rooms')
    .select(`
      id,
      name,
      description,
      is_locked,
      room_participants (
        user_id
      )
    `)
    .eq('invite_code', code.toUpperCase())
    .single()

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite Code</h1>
          <p className="text-muted-foreground mb-4">
            This invite code is not valid or has expired.
          </p>
          <a href="/dashboard" className="text-primary hover:underline">
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }

  // Check if user is already in the room
  const isAlreadyMember = room.room_participants.some(
    (p: { user_id: string }) => p.user_id === user.id
  )

  if (isAlreadyMember) {
    redirect(`/rooms/${room.id}`)
  }

  // Check if room is full
  const isFull = room.room_participants.length >= 2

  return (
    <JoinRoomPage 
      room={room}
      inviteCode={code}
      isFull={isFull}
      userId={user.id}
    />
  )
}