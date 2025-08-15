import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in first' },
        { status: 401 }
      )
    }

    const { inviteCode } = await request.json()

    if (!inviteCode || inviteCode.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid invite code format' },
        { status: 400 }
      )
    }

    // Find room by invite code
    const { data: room, error: roomError } = await supabase
      .from('collaboration_rooms')
      .select(`
        *,
        room_participants (
          user_id,
          role
        )
      `)
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Check if room is already full (2 participants max)
    if (room.room_participants.length >= 2) {
      return NextResponse.json(
        { error: 'Room is full (maximum 2 participants allowed)' },
        { status: 400 }
      )
    }

    // Check if user is already in the room
    const alreadyJoined = room.room_participants.some(
      (p: { user_id: string }) => p.user_id === user.id
    )

    if (alreadyJoined) {
      return NextResponse.json({
        room,
        alreadyMember: true,
        message: 'You are already a member of this room'
      })
    }

    // Add user as participant
    const { error: participantError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'participant'
      })

    if (participantError) {
      console.error('Add participant error:', participantError)
      return NextResponse.json(
        { error: 'Failed to join room' },
        { status: 500 }
      )
    }

    // Lock room since we now have 2 participants
    if (room.room_participants.length === 1) { // Was 1, now 2 with new participant
      await supabase
        .from('collaboration_rooms')
        .update({ is_locked: true })
        .eq('id', room.id)
    }

    return NextResponse.json({
      room,
      alreadyMember: false,
      message: 'Successfully joined room'
    })

  } catch (error) {
    console.error('Join room error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to validate invite code without joining
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const inviteCode = searchParams.get('code')

    if (!inviteCode || inviteCode.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid invite code format' },
        { status: 400 }
      )
    }

    // Find room by invite code
    const { data: room, error } = await supabase
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
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (error || !room) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Check if room is full
    const isFull = room.room_participants.length >= 2

    return NextResponse.json({
      valid: true,
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        isFull,
        isLocked: room.is_locked
      }
    })

  } catch (error) {
    console.error('Validate invite code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}