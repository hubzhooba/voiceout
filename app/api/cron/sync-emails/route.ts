import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// This endpoint can be called by Vercel Cron or external services
export async function GET(request: Request) {
  try {
    // Optional: Add secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    
    // Get all active email connections
    const { data: connections, error } = await supabase
      .from('email_connections')
      .select('id, email_provider')
      .eq('is_active', true)
    
    if (error) {
      throw error
    }
    
    let totalSynced = 0
    const results = []
    
    // Trigger sync for each connection
    for (const connection of connections || []) {
      // Only sync Gmail for now (Yahoo requires IMAP which doesn't work in serverless)
      if (connection.email_provider === 'gmail') {
        try {
          // Call the existing sync endpoint
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionId: connection.id })
          })
          
          if (response.ok) {
            const result = await response.json()
            results.push({
              connectionId: connection.id,
              success: true,
              ...result
            })
            totalSynced++
          }
        } catch (err) {
          console.error(`Error syncing connection ${connection.id}:`, err)
          results.push({
            connectionId: connection.id,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totalConnections: connections?.length || 0,
      totalSynced,
      results
    })
  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    )
  }
}