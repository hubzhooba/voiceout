import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tentId = searchParams.get('tentId')

    if (!tentId) {
      return NextResponse.json(
        { error: 'Tent ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has access to this tent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member, error: memberError } = await (supabase as any)
      .from('tent_members')
      .select('*')
      .eq('tent_id', tentId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to this tent' },
        { status: 403 }
      )
    }

    // Fetch email connections for this tent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connections, error: connectionsError } = await (supabase as any)
      .from('email_connections')
      .select('*')
      .eq('tent_id', tentId)
      .order('created_at', { ascending: false })

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError)
      // Return empty array if table doesn't exist yet
      return NextResponse.json({ connections: [] })
    }

    return NextResponse.json({ 
      connections: connections || [],
      userRole: member.role 
    })

  } catch (error) {
    console.error('Error in email connect API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { tentId, email, provider, apiKey } = body

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has access to this tent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member, error: memberError } = await (supabase as any)
      .from('tent_members')
      .select('*')
      .eq('tent_id', tentId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to this tent' },
        { status: 403 }
      )
    }

    // Store email connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection, error: connectionError } = await (supabase as any)
      .from('email_connections')
      .insert({
        tent_id: tentId,
        user_id: user.id,
        email,
        provider,
        api_key: apiKey, // In production, this should be encrypted
        is_active: true
      })
      .select()
      .single()

    if (connectionError) {
      console.error('Error saving connection:', connectionError)
      return NextResponse.json(
        { error: 'Failed to save email connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      connection 
    })

  } catch (error) {
    console.error('Error in email connect POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete the connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('email_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', user.id) // Ensure user owns this connection

    if (deleteError) {
      console.error('Error deleting connection:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in email connect DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}