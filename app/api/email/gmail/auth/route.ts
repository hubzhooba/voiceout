import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

// Scopes needed for reading emails
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
]

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tentId = searchParams.get('tentId')
    
    // Check authentication
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

    // Store tent ID in session for callback
    const { error: sessionError } = await supabase
      .from('profiles')
      .update({ 
        preferences: {
          pending_email_connection: {
            tent_id: tentId,
            provider: 'gmail',
            timestamp: new Date().toISOString()
          }
        }
      })
      .eq('id', user.id)

    if (sessionError) {
      console.error('Error storing session:', sessionError)
    }

    // Get OAuth config from database
    const { data: configData } = await supabase
      .rpc('get_oauth_config', {
        p_tent_id: tentId,
        p_provider: 'gmail'
      })
    
    const clientId = configData?.client_id || process.env.GOOGLE_CLIENT_ID
    let clientSecret = configData?.client_secret || process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = configData?.redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL}/api/email/gmail/callback`
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Gmail OAuth is not configured. Please configure OAuth in tent settings.' },
        { status: 500 }
      )
    }
    
    // Decrypt client secret if from database
    if (configData?.client_secret) {
      const { decrypt } = await import('@/lib/encryption')
      clientSecret = await decrypt(configData.client_secret)
    }
    
    // Create OAuth client with tenant-specific credentials
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    )

    // Generate the OAuth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: JSON.stringify({ userId: user.id, tentId })
    })

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Error generating Gmail auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    )
  }
}