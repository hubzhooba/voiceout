import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { name, description, creatorRole } = body

    // Validate input
    if (!name || !creatorRole) {
      return NextResponse.json(
        { error: 'Name and creator role are required' },
        { status: 400 }
      )
    }

    if (!['client', 'manager'].includes(creatorRole)) {
      return NextResponse.json(
        { error: 'Invalid creator role' },
        { status: 400 }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Generate invite code
    const inviteCode = nanoid(8).toUpperCase()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   `${request.headers.get('origin') || 'http://localhost:3000'}`
    const inviteLink = `${baseUrl}/tents/join/${inviteCode}`

    // Create tent
    const { data: tent, error: tentError } = await supabase
      .from('tents')
      .insert({
        name,
        description,
        created_by: user.id,
        invite_code: inviteCode,
        invite_link: inviteLink,
        creator_role: creatorRole,
      })
      .select()
      .single()

    if (tentError) {
      console.error('Error creating tent:', tentError)
      return NextResponse.json(
        { error: 'Failed to create tent' },
        { status: 500 }
      )
    }

    // Create tent member entry for creator
    const memberRole = creatorRole === 'client' ? 'client' : 'admin'
    const { error: memberError } = await supabase
      .from('tent_members')
      .insert({
        tent_id: tent.id,
        user_id: user.id,
        role: memberRole,
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('Error adding member:', memberError)
      // Clean up tent if member creation fails
      await supabase.from('tents').delete().eq('id', tent.id)
      return NextResponse.json(
        { error: 'Failed to create tent member' },
        { status: 500 }
      )
    }

    // Determine invited user role
    const invitedUserRole = creatorRole === 'client' ? 'manager' : 'client'

    return NextResponse.json({
      tent,
      inviteCode,
      inviteLink,
      invitedUserRole,
      message: 'Tent created successfully',
    })
  } catch (error) {
    console.error('Error in create tent API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}