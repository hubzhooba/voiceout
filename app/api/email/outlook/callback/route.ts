import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    // Handle OAuth errors
    if (error) {
      console.error('Outlook OAuth error:', error)
      redirect('/dashboard?error=outlook_auth_failed')
    }
    
    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      )
    }

    // Parse state to get tent info
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state || '', 'base64').toString())
    } catch {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      )
    }

    // Exchange code for tokens
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/outlook/callback`
    
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    // Prepare token exchange request
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Outlook token exchange failed:', errorData)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()
    
    // Get user's email address from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch Outlook profile')
    }

    const profile = await profileResponse.json()
    const emailAddress = profile.mail || profile.userPrincipalName
    
    if (!emailAddress) {
      throw new Error('Could not retrieve email address from Outlook')
    }

    // Store the email connection in database
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tentId: stateData.tentId,
        emailProvider: 'outlook',
        emailAddress: emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in ? 
          new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save email connection')
    }

    // Redirect back to tent settings with success message
    redirect(`/tents/${stateData.tentId}/settings?email_connected=true&provider=outlook`)
  } catch (error) {
    console.error('Error in Outlook callback:', error)
    // Redirect with error
    redirect('/dashboard?error=outlook_connection_failed')
  }
}