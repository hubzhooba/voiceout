import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { connectionId } = await request.json()

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      )
    }

    // Get the email connection
    const { data: connection, error: connectionError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Email connection not found' },
        { status: 404 }
      )
    }

    // For now, just update the last sync timestamp
    // Yahoo IMAP doesn't work in serverless environment
    // In production, you would use a background job or external service
    await supabase
      .from('email_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: 'active'
      })
      .eq('id', connectionId)

    return NextResponse.json({
      success: true,
      emailsFetched: 0,
      inquiriesCreated: 0,
      message: 'Yahoo email sync requires a background service. Connection saved successfully.'
    })
  } catch (error) {
    console.error('Error syncing Yahoo emails:', error)
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    )
  }
}