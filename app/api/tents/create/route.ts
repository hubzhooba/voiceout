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

    const { 
      name, 
      description, 
      creatorRole // 'client' or 'manager'
    } = await request.json()

    if (!name || !creatorRole) {
      return NextResponse.json(
        { error: 'Tent name and creator role are required' },
        { status: 400 }
      )
    }

    if (creatorRole !== 'client' && creatorRole !== 'manager') {
      return NextResponse.json(
        { error: 'Creator role must be either "client" or "manager"' },
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
        .from('tents')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()
      
      if (!existing) {
        isUnique = true
      }
    }

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tents/join/${inviteCode!}`

    // Create the tent
    const { data: tent, error: tentError } = await supabase
      .from('tents')
      .insert({
        name,
        description,
        created_by: user.id,
        invite_code: inviteCode!,
        invite_link: inviteLink,
        creator_role: creatorRole,
        is_locked: false,
        tent_type: 'invoice_management'
      })
      .select()
      .single()

    if (tentError) {
      console.error('Tent creation error:', tentError)
      return NextResponse.json(
        { error: 'Failed to create tent' },
        { status: 500 }
      )
    }

    // Add creator as first member with their chosen role and admin status
    const { error: memberError } = await supabase
      .from('tent_members')
      .insert({
        tent_id: tent.id,
        user_id: user.id,
        tent_role: creatorRole,
        is_admin: true // Creator is always admin
      })

    if (memberError) {
      // Rollback tent creation if member insertion fails
      await supabase
        .from('tents')
        .delete()
        .eq('id', tent.id)
      
      return NextResponse.json(
        { error: 'Failed to add creator as tent member' },
        { status: 500 }
      )
    }

    // Determine what role the invited user will have
    const invitedUserRole = creatorRole === 'client' ? 'manager' : 'client'

    return NextResponse.json({
      tent,
      inviteCode: inviteCode!,
      inviteLink,
      creatorRole,
      invitedUserRole
    })

  } catch (error) {
    console.error('Create tent error:', error)
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