import { NextResponse } from 'next/server'
import { google } from 'googleapis'
// import { createClient } from '@/lib/supabase/server' // Not needed
import { redirect } from 'next/navigation'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/email/gmail/callback`
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      )
    }

    // Parse state to get user and tent info
    let stateData
    try {
      stateData = JSON.parse(state || '{}')
    } catch {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user's email address
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const emailAddress = profile.data.emailAddress

    if (!emailAddress) {
      return NextResponse.json(
        { error: 'Could not retrieve email address' },
        { status: 500 }
      )
    }

    // Save the connection to database
    // const supabase = await createClient() // Not needed since we use fetch
    
    // Store the email connection
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tentId: stateData.tentId,
        emailProvider: 'gmail',
        emailAddress: emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save email connection')
    }

    // Redirect back to tent settings with success message
    redirect(`/tents/${stateData.tentId}/settings?email_connected=true`)
  } catch (error) {
    console.error('Error in Gmail callback:', error)
    // Redirect with error
    redirect('/dashboard?error=email_connection_failed')
  }
}