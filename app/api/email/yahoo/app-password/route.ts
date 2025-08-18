import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import * as Imap from 'node-imap'

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

    // Verify the connection works with IMAP
    const testConnection = await verifyImapConnection(email, appPassword)
    
    if (!testConnection.success) {
      return NextResponse.json(
        { error: testConnection.error || 'Failed to connect to Yahoo Mail' },
        { status: 400 }
      )
    }

    // Encrypt the app password
    const encryptedPassword = await encrypt(appPassword)

    // Store the email connection
    const { data: connection, error: connectionError } = await supabase
      .from('email_connections')
      .insert({
        user_id: user.id,
        tent_id: tentId,
        email_provider: 'yahoo',
        email_address: email,
        // Store as refresh_token since we're using app password instead of OAuth
        refresh_token: encryptedPassword,
        connection_type: 'app_password',
        is_active: true,
        sync_status: 'active'
      })
      .select()
      .single()

    if (connectionError) {
      console.error('Error storing connection:', connectionError)
      return NextResponse.json(
        { error: 'Failed to save email connection' },
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
      { error: 'Failed to connect Yahoo Mail' },
      { status: 500 }
    )
  }
}

async function verifyImapConnection(email: string, appPassword: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imap = new (Imap as any)({
      user: email,
      password: appPassword,
      host: 'imap.mail.yahoo.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000
    })

    const timeoutId = setTimeout(() => {
      imap.end()
      resolve({ success: false, error: 'Connection timeout' })
    }, 15000)

    imap.once('ready', () => {
      clearTimeout(timeoutId)
      imap.end()
      resolve({ success: true })
    })

    imap.once('error', (err: Error) => {
      clearTimeout(timeoutId)
      console.error('IMAP Error:', err)
      resolve({ 
        success: false, 
        error: err.message.includes('authentication') 
          ? 'Invalid email or app password. Make sure you\'re using an app-specific password from Yahoo.'
          : 'Failed to connect to Yahoo Mail servers'
      })
    })

    try {
      imap.connect()
    } catch (err) {
      clearTimeout(timeoutId)
      resolve({ success: false, error: 'Failed to initiate connection' })
    }
  })
}