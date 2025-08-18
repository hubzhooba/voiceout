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

    // Microsoft OAuth 2.0 configuration for Outlook/Hotmail
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/outlook/callback`
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Microsoft OAuth is not configured' },
        { status: 500 }
      )
    }

    // Microsoft OAuth 2.0 authorization URL
    const state = Buffer.from(JSON.stringify({ tentId })).toString('base64')
    
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('response_mode', 'query')
    authUrl.searchParams.append('scope', 'openid profile email offline_access https://outlook.office.com/Mail.Read')
    authUrl.searchParams.append('state', state)
    
    return NextResponse.json({ authUrl: authUrl.toString() })
  } catch (error) {
    console.error('Error initiating Outlook auth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Outlook authentication' },
      { status: 500 }
    )
  }
}