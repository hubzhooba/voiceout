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

    // Find tent by invite code
    const { data: tent, error: tentError } = await supabase
      .from('tents')
      .select(`
        *,
        tent_members (
          user_id,
          tent_role,
          is_admin
        )
      `)
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (tentError || !tent) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Check if tent is already full (2 members max)
    if (tent.tent_members.length >= 2) {
      return NextResponse.json(
        { error: 'Tent is full (maximum 2 members allowed)' },
        { status: 400 }
      )
    }

    // Check if user is already in the tent
    const alreadyJoined = tent.tent_members.some(
      (m: { user_id: string }) => m.user_id === user.id
    )

    if (alreadyJoined) {
      return NextResponse.json({
        tent,
        alreadyMember: true,
        message: 'You are already a member of this tent'
      })
    }

    // Get the creator's role to assign opposite role
    const creatorMember = tent.tent_members[0]
    const newMemberRole = creatorMember.tent_role === 'client' ? 'manager' : 'client'

    // Add user as member with opposite role
    const { error: memberError } = await supabase
      .from('tent_members')
      .insert({
        tent_id: tent.id,
        user_id: user.id,
        tent_role: newMemberRole,
        is_admin: false // Invited user is not admin
      })

    if (memberError) {
      console.error('Add member error:', memberError)
      return NextResponse.json(
        { error: 'Failed to join tent' },
        { status: 500 }
      )
    }

    // Lock tent since we now have 2 members
    await supabase
      .from('tents')
      .update({ is_locked: true })
      .eq('id', tent.id)

    return NextResponse.json({
      tent,
      alreadyMember: false,
      assignedRole: newMemberRole,
      message: `Successfully joined tent as ${newMemberRole}`
    })

  } catch (error) {
    console.error('Join tent error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to validate invite code and preview tent
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

    // Find tent by invite code
    const { data: tent, error } = await supabase
      .from('tents')
      .select(`
        id,
        name,
        description,
        is_locked,
        creator_role,
        tent_members (
          user_id,
          tent_role
        )
      `)
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (error || !tent) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Check if tent is full
    const isFull = tent.tent_members.length >= 2
    
    // Determine what role the joining user would get
    const creatorMember = tent.tent_members[0]
    const joiningRole = creatorMember?.tent_role === 'client' ? 'manager' : 'client'

    return NextResponse.json({
      valid: true,
      tent: {
        id: tent.id,
        name: tent.name,
        description: tent.description,
        isFull,
        isLocked: tent.is_locked,
        joiningRole
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