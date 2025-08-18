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
      console.error('Yahoo OAuth error:', error)
      redirect('/dashboard?error=yahoo_auth_failed')
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

    // Get OAuth credentials from database
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    
    // Get OAuth config from database
    const { data: configData } = await supabase
      .rpc('get_oauth_config', {
        p_tent_id: stateData.tentId,
        p_provider: 'yahoo'
      })
    
    // Decrypt the client secret
    const { decrypt } = await import('@/lib/encryption')
    
    let clientId = configData?.client_id
    let clientSecret = configData?.client_secret ? await decrypt(configData.client_secret) : null
    let redirectUri = configData?.redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL}/api/email/yahoo/callback`
    
    // Fallback to environment variables if no database config
    if (!clientId || !clientSecret) {
      clientId = process.env.YAHOO_CLIENT_ID
      clientSecret = process.env.YAHOO_CLIENT_SECRET
      redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/yahoo/callback`
    }
    
    if (!clientId || !clientSecret) {
      throw new Error('Yahoo OAuth credentials not configured')
    }
    
    // Exchange code for tokens
    const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token'

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
      console.error('Yahoo token exchange failed:', errorData)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()
    
    // Get user's email address from Yahoo profile
    const profileResponse = await fetch('https://api.login.yahoo.com/openid/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch Yahoo profile')
    }

    const profile = await profileResponse.json()
    const emailAddress = profile.email
    
    if (!emailAddress) {
      throw new Error('Could not retrieve email address from Yahoo')
    }

    // Store the email connection in database
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tentId: stateData.tentId,
        emailProvider: 'yahoo',
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
    redirect(`/tents/${stateData.tentId}/settings?email_connected=true&provider=yahoo`)
  } catch (error) {
    console.error('Error in Yahoo callback:', error)
    // Redirect with error
    redirect('/dashboard?error=yahoo_connection_failed')
  }
}