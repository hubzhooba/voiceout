import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { inviteCode } = body

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    // Find tent by invite code
    const { data: tent, error: tentError } = await supabase
      .from('tents')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (tentError || !tent) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Check if tent is locked
    if (tent.is_locked) {
      return NextResponse.json(
        { error: 'This tent is no longer accepting new members' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('tent_members')
      .select('*')
      .eq('tent_id', tent.id)
      .eq('user_id', user.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { 
          message: 'You are already a member of this tent',
          tent,
          alreadyMember: true 
        },
        { status: 200 }
      )
    }

    // Check if tent already has 2 members (max capacity)
    const { count } = await supabase
      .from('tent_members')
      .select('*', { count: 'exact', head: true })
      .eq('tent_id', tent.id)

    if (count && count >= 2) {
      return NextResponse.json(
        { error: 'This tent is already at maximum capacity (2 members)' },
        { status: 403 }
      )
    }

    // Determine the role for the joining user
    // If creator is client, joiner is manager
    // If creator is manager, joiner is client
    const tentRole = tent.creator_role === 'client' ? 'manager' : 'client'
    const isAdmin = tentRole === 'manager'

    // Add user as member
    const { data: newMember, error: memberError } = await supabase
      .from('tent_members')
      .insert({
        tent_id: tent.id,
        user_id: user.id,
        tent_role: tentRole,
        is_admin: isAdmin,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (memberError) {
      console.error('Error adding member:', memberError)
      return NextResponse.json(
        { error: 'Failed to join tent' },
        { status: 500 }
      )
    }

    // Lock the tent after second member joins
    if (count === 1) {
      await supabase
        .from('tents')
        .update({ is_locked: true })
        .eq('id', tent.id)
    }

    // Get user profile for notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Create notification for tent creator
    if (tent.created_by !== user.id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: tent.created_by,
          type: 'tent_joined',
          title: 'New member joined your tent',
          message: `${profile?.full_name || profile?.email || 'Someone'} has joined ${tent.name}`,
          metadata: {
            tent_id: tent.id,
            joined_user_id: user.id,
            joined_user_name: profile?.full_name || profile?.email
          },
          read: false
        })
    }

    return NextResponse.json({
      message: 'Successfully joined tent',
      tent,
      member: newMember,
      role: tentRole
    })
  } catch (error) {
    console.error('Error in join tent API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}