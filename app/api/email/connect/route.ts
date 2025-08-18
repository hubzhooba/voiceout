import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption' // We'll create this utility

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

    const body = await request.json()
    const {
      tentId,
      emailProvider,
      emailAddress,
      accessToken,
      refreshToken,
      apiKey,
      apiSecret,
      tokenExpiry
    } = body

    // Validate required fields
    if (!tentId || !emailProvider || !emailAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user is member of the tent
    const { data: member } = await supabase
      .from('tent_members')
      .select('*')
      .eq('tent_id', tentId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this tent' },
        { status: 403 }
      )
    }

    // Encrypt sensitive data before storing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encryptedData: Record<string, any> = {
      user_id: user.id,
      tent_id: tentId,
      email_provider: emailProvider,
      email_address: emailAddress,
      sync_status: 'pending',
      is_active: true
    }

    // Encrypt tokens if provided (OAuth flow)
    if (accessToken) {
      encryptedData.access_token = await encrypt(accessToken)
    }
    if (refreshToken) {
      encryptedData.refresh_token = await encrypt(refreshToken)
    }
    if (tokenExpiry) {
      encryptedData.token_expiry = tokenExpiry
    }

    // Encrypt API credentials if provided (API key flow)
    if (apiKey) {
      encryptedData.api_key = await encrypt(apiKey)
    }
    if (apiSecret) {
      encryptedData.api_secret = await encrypt(apiSecret)
    }

    // Create or update email connection
    const { data: connection, error } = await supabase
      .from('email_connections')
      .upsert(encryptedData, {
        onConflict: 'user_id,email_address,tent_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating email connection:', error)
      return NextResponse.json(
        { error: 'Failed to save email connection' },
        { status: 500 }
      )
    }

    // Trigger initial sync (we'll implement this webhook separately)
    if (connection) {
      // Queue initial email sync
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id })
      })
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        email_address: connection.email_address,
        email_provider: connection.email_provider,
        sync_status: connection.sync_status
      }
    })
  } catch (error) {
    console.error('Error in email connect:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve email connections
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tentId = searchParams.get('tentId')
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!tentId) {
      return NextResponse.json(
        { error: 'Tent ID required' },
        { status: 400 }
      )
    }

    // Get email connections for the tent
    const { data: connections, error } = await supabase
      .from('email_connections')
      .select('id, email_address, email_provider, is_active, sync_status, last_sync_at')
      .eq('tent_id', tentId)

    if (error) {
      console.error('Error fetching connections:', error)
      return NextResponse.json(
        { error: 'Failed to fetch email connections' },
        { status: 500 }
      )
    }

    return NextResponse.json({ connections })
  } catch (error) {
    console.error('Error in get connections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE endpoint to remove email connection
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      )
    }

    // Delete the connection (RLS will ensure user owns it)
    const { error } = await supabase
      .from('email_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting connection:', error)
      return NextResponse.json(
        { error: 'Failed to delete connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in delete connection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}