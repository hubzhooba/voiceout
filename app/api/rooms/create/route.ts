import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, description, workspaceId } = await request.json()

    if (!name || !workspaceId) {
      return NextResponse.json(
        { error: 'Room name and workspace ID are required' },
        { status: 400 }
      )
    }

    // Generate unique invite code
    let inviteCode: string
    let isUnique = false
    
    while (!isUnique) {
      inviteCode = generateInviteCode()
      
      // Check if code already exists
      const { data: existing } = await supabase
        .from('collaboration_rooms')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()
      
      if (!existing) {
        isUnique = true
      }
    }

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/rooms/join/${inviteCode!}`

    // Create the room
    const { data: room, error: roomError } = await supabase
      .from('collaboration_rooms')
      .insert({
        name,
        description,
        created_by: user.id,
        invite_code: inviteCode!,
        invite_link: inviteLink,
        workspace_id: workspaceId,
        is_locked: false
      })
      .select()
      .single()

    if (roomError) {
      console.error('Room creation error:', roomError)
      return NextResponse.json(
        { error: 'Failed to create room' },
        { status: 500 }
      )
    }

    // Add creator as first participant with manager role
    const { error: participantError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'creator',
        workflow_role: 'manager' // Creator is manager by default
      })

    if (participantError) {
      // Rollback room creation if participant insertion fails
      await supabase
        .from('collaboration_rooms')
        .delete()
        .eq('id', room.id)
      
      return NextResponse.json(
        { error: 'Failed to add creator as participant' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      room,
      inviteCode: inviteCode!,
      inviteLink
    })

  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}