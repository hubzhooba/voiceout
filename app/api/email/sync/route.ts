import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { decrypt } from '@/lib/encryption'
import { analyzeEmailWithAI } from '@/lib/ai/email-analyzer'

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
        emails = await syncYahooEmails(connection)
      }
      
      // Process emails with AI
      const inquiries = []
      for (const email of emails) {
        const analysis = await analyzeEmailWithAI(email)
        
        // Only save if it's a legitimate business inquiry
        if (analysis.isLegitimate && analysis.importanceScore > 30) {
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
            company_name: analysis.extractedData.companyName,
            contact_person: analysis.extractedData.contactPerson,
            contact_phone: analysis.extractedData.contactPhone,
            budget_range: analysis.extractedData.budgetRange,
            project_timeline: analysis.extractedData.projectTimeline,
            project_description: analysis.extractedData.projectDescription,
            importance_score: analysis.importanceScore,
            sentiment_score: analysis.sentimentScore,
            is_legitimate: analysis.isLegitimate,
            ai_summary: analysis.summary,
            extracted_keywords: analysis.keywords,
            status: 'pending'
          })
        }
      }

      // Bulk insert inquiries
      if (inquiries.length > 0) {
        const { error: insertError } = await supabase
          .from('email_inquiries')
          .upsert(inquiries, {
            onConflict: 'email_connection_id,email_id'
          })

        if (insertError) {
          console.error('Error inserting inquiries:', insertError)
        }
      }

      // Update sync log
      await supabase
        .from('email_sync_log')
        .update({
          sync_completed_at: new Date().toISOString(),
          emails_fetched: emails.length,
          inquiries_created: inquiries.length,
          status: 'completed'
        })
        .eq('id', syncLog?.id)

      // Update last sync time
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
      // Log sync error
      await supabase
        .from('email_sync_log')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'failed',
          error_details: syncError instanceof Error ? syncError.message : 'Unknown error'
        })
        .eq('id', syncLog?.id)

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
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/email/gmail/callback`
  )

  // Decrypt and set credentials
  const accessToken = await decrypt(connection.access_token)
  const refreshToken = await decrypt(connection.refresh_token)
  
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
function extractEmailBody(payload: any): { text: string, html: string } { // eslint-disable-line @typescript-eslint/no-explicit-any
  let text = ''
  let html = ''

  const extractFromParts = (parts: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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

// Yahoo sync function (placeholder - requires Yahoo API setup)
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
async function syncYahooEmails(connection: Record<string, any>) {
  // TODO: Implement Yahoo Mail API integration
  // This would require Yahoo OAuth setup and API access
  return []
}