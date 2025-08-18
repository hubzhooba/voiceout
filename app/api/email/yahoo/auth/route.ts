import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tentId = searchParams.get('tentId')
    
    if (!tentId) {
      return NextResponse.json(
        { error: 'Tent ID is required' },
        { status: 400 }
      )
    }

    // Try to get tenant-specific OAuth configuration first
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    
    // Get OAuth config from database (tenant-specific or app-level)
    const { data: configData } = await supabase
      .rpc('get_oauth_config', {
        p_tent_id: tentId,
        p_provider: 'yahoo'
      })
    
    let clientId = configData?.client_id
    let redirectUri = configData?.redirect_uri
    
    // Fallback to environment variables if no database config
    if (!clientId) {
      clientId = process.env.YAHOO_CLIENT_ID
      redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/yahoo/callback`
    }
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Yahoo OAuth is not configured. Please configure OAuth in tent settings.' },
        { status: 500 }
      )
    }

    // Yahoo OAuth 2.0 authorization URL
    const state = Buffer.from(JSON.stringify({ tentId })).toString('base64')
    
    const authUrl = new URL('https://api.login.yahoo.com/oauth2/request_auth')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scope', 'mail-r profile email') // Read mail, profile, and email
    authUrl.searchParams.append('state', state)
    
    return NextResponse.json({ authUrl: authUrl.toString() })
  } catch (error) {
    console.error('Error initiating Yahoo auth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Yahoo authentication' },
      { status: 500 }
    )
  }
}