import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { decrypt } from '@/lib/encryption'
import { analyzeEmailInquiry } from '@/lib/ai/email-analyzer'

export async function POST(request: Request) {
  try {
    const { connectionId } = await request.json()
    
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
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

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('email_sync_log')
      .insert({
        email_connection_id: connectionId,
        sync_started_at: new Date().toISOString(),
        status: 'running'
      })
      .select()
      .single()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let emails: any[] = []
      
      // Handle different email providers
      if (connection.email_provider === 'gmail') {
        emails = await syncGmailEmails(connection)
      } else if (connection.email_provider === 'yahoo') {
        // Yahoo requires background service for IMAP
        // For now, just update sync status
        await supabase
          .from('email_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_status: 'active'
          })
          .eq('id', connectionId)
        
        // Return success with message
        if (syncLog) {
          await supabase
            .from('email_sync_log')
            .update({
              sync_completed_at: new Date().toISOString(),
              status: 'completed',
              emails_fetched: 0,
              inquiries_created: 0
            })
            .eq('id', syncLog.id)
        }
        
        return NextResponse.json({
          success: true,
          emailsFetched: 0,
          inquiriesCreated: 0,
          message: 'Yahoo email sync requires a background service. Connection is active.'
        })
      } else if (connection.email_provider === 'outlook') {
        // Outlook sync not implemented yet
        if (syncLog) {
          await supabase
            .from('email_sync_log')
            .update({
              sync_completed_at: new Date().toISOString(),
              status: 'completed',
              emails_fetched: 0,
              inquiries_created: 0
            })
            .eq('id', syncLog.id)
        }
        
        return NextResponse.json({
          success: true,
          emailsFetched: 0,
          inquiriesCreated: 0,
          message: 'Outlook email sync not yet implemented.'
        })
      }
      
      // Process emails with AI
      const inquiries = []
      for (const email of emails) {
        const analysis = await analyzeEmailInquiry({
          from: `${email.from.name} <${email.from.email}>`,
          subject: email.subject,
          body: email.bodyText
        })
        
        // Only save if it's a legitimate business inquiry
        if (analysis.isBusinessInquiry && analysis.seriousnessScore >= 7) {
          inquiries.push({
            tent_id: connection.tent_id,
            email_connection_id: connectionId,
            email_id: email.id,
            thread_id: email.threadId,
            from_email: email.from.email,
            from_name: email.from.name,
            subject: email.subject,
            body_text: email.bodyText,
            body_html: email.bodyHtml,
            received_at: email.receivedAt,
            inquiry_type: analysis.inquiryType,
            seriousness_score: analysis.seriousnessScore,
            is_business_inquiry: analysis.isBusinessInquiry,
            ai_summary: analysis.summary,
            status: 'pending'
          })
        }
      }

      // Bulk insert inquiries
      if (inquiries.length > 0) {
        const { error: insertError } = await supabase
          .from('email_inquiries')
          .insert(inquiries)

        if (insertError) {
          console.error('Error inserting inquiries:', insertError)
        }
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from('email_sync_log')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'completed',
            emails_fetched: emails.length,
            inquiries_created: inquiries.length
          })
          .eq('id', syncLog.id)
      }

      // Update last sync timestamp
      await supabase
        .from('email_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_status: 'active'
        })
        .eq('id', connectionId)

      return NextResponse.json({
        success: true,
        emailsFetched: emails.length,
        inquiriesCreated: inquiries.length
      })
    } catch (syncError) {
      console.error('Sync error:', syncError)
      
      // Update sync log with error
      if (syncLog) {
        await supabase
          .from('email_sync_log')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'failed',
            error_message: syncError instanceof Error ? syncError.message : 'Unknown error'
          })
          .eq('id', syncLog.id)
      }

      // Update connection status
      await supabase
        .from('email_connections')
        .update({
          sync_status: 'error',
          error_message: syncError instanceof Error ? syncError.message : 'Sync failed'
        })
        .eq('id', connectionId)

      throw syncError
    }
  } catch (error) {
    console.error('Error in email sync:', error)
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    )
  }
}

// Gmail sync function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncGmailEmails(connection: Record<string, any>) {
  // Decrypt tokens
  const accessToken = await decrypt(connection.access_token)
  const refreshToken = connection.refresh_token ? await decrypt(connection.refresh_token) : null

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/email/gmail/callback`
  )

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  
  // Query for emails from the last sync or last 7 days
  const after = connection.last_sync_at 
    ? new Date(connection.last_sync_at).getTime() / 1000 
    : Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
  
  const query = `is:unread after:${after} -category:promotions -category:social -category:forums`
  
  // List messages
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50
  })

  const messages = response.data.messages || []
  const emails = []

  // Fetch full message details
  for (const message of messages) {
    if (!message.id) continue
    
    const fullMessage = await gmail.users.messages.get({
      userId: 'me',
      id: message.id
    })

    const headers = fullMessage.data.payload?.headers || []
    const from = headers.find(h => h.name === 'From')?.value || ''
    const subject = headers.find(h => h.name === 'Subject')?.value || ''
    const date = headers.find(h => h.name === 'Date')?.value || ''
    
    // Extract email body
    const body = extractEmailBody(fullMessage.data.payload)
    
    // Parse from field
    const fromMatch = from.match(/(.*?)<(.*?)>/)
    const fromName = fromMatch ? fromMatch[1].trim() : from
    const fromEmail = fromMatch ? fromMatch[2] : from

    emails.push({
      id: message.id,
      threadId: fullMessage.data.threadId,
      from: {
        name: fromName,
        email: fromEmail
      },
      subject,
      bodyText: body.text,
      bodyHtml: body.html,
      receivedAt: new Date(date).toISOString()
    })
  }

  return emails
}

// Extract email body from Gmail payload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEmailBody(payload: any): { text: string, html: string } {
  let text = ''
  let html = ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractFromParts = (parts: any[]) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.parts) {
        extractFromParts(part.parts)
      }
    }
  }

  if (payload.parts) {
    extractFromParts(payload.parts)
  } else if (payload.body?.data) {
    const body = Buffer.from(payload.body.data, 'base64').toString('utf-8')
    if (payload.mimeType === 'text/html') {
      html = body
    } else {
      text = body
    }
  }

  return { text, html }
}