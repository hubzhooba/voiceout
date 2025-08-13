import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { workspaceId, email, role } = body

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member || (member.role !== 'admin' && member.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        invited_by: user.id,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitations/${invitation.id}`
    
    console.log('Invitation URL:', inviteUrl)

    return NextResponse.json({ 
      success: true, 
      invitation,
      inviteUrl 
    })
  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}