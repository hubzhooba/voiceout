import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'

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

    const { tentId, email, appPassword } = await request.json()

    if (!tentId || !email || !appPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Basic validation
    if (!email.includes('@yahoo.com') && !email.includes('@ymail.com')) {
      return NextResponse.json(
        { error: 'Please use a valid Yahoo email address' },
        { status: 400 }
      )
    }

    // Validate app password format (Yahoo app passwords are 16 characters without spaces)
    const cleanPassword = appPassword.replace(/\s/g, '')
    if (cleanPassword.length !== 16) {
      return NextResponse.json(
        { error: 'Invalid app password format. Yahoo app passwords are 16 characters long.' },
        { status: 400 }
      )
    }

    // Encrypt the app password
    const encryptedPassword = await encrypt(cleanPassword)

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('email_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('tent_id', tentId)
      .eq('email_address', email)
      .single()

    let connection
    let connectionError

    if (existingConnection) {
      // Update existing connection
      const { data, error } = await supabase
        .from('email_connections')
        .update({
          email_provider: 'yahoo',
          refresh_token: encryptedPassword,
          is_active: true,
          sync_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
        .select()
        .single()
      
      connection = data
      connectionError = error
    } else {
      // Create new connection
      const { data, error } = await supabase
        .from('email_connections')
        .insert({
          user_id: user.id,
          tent_id: tentId,
          email_provider: 'yahoo',
          email_address: email,
          // Store as refresh_token since we're using app password instead of OAuth
          refresh_token: encryptedPassword,
          is_active: true,
          sync_status: 'active'
        })
        .select()
        .single()
      
      connection = data
      connectionError = error
    }

    if (connectionError) {
      console.error('Error storing connection:', connectionError)
      return NextResponse.json(
        { error: `Database error: ${connectionError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        email_address: connection.email_address,
        email_provider: connection.email_provider
      }
    })
  } catch (error) {
    console.error('Error in Yahoo app password connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Yahoo Mail' },
      { status: 500 }
    )
  }
}