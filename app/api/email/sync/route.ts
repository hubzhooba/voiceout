import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { decrypt, encrypt } from '@/lib/encryption'
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
      } else if (connection.email_provider === 'outlook') {
        emails = await syncOutlookEmails(connection)
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

// Yahoo sync function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncYahooEmails(connection: Record<string, any>) {
  try {
    const accessToken = await decrypt(connection.access_token)
    
    // Yahoo Mail API endpoint for fetching messages
    const baseUrl = 'https://api.mail.yahoo.com/ws/v3/mailboxes/@.id==1/messages'
    
    // Calculate date filter (last sync or last 7 days)
    const after = connection.last_sync_at 
      ? new Date(connection.last_sync_at).getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000
    
    // Build query parameters
    const params = new URLSearchParams({
      'q': `after:${Math.floor(after / 1000)}`, // Yahoo uses Unix timestamp
      'max': '50', // Limit to 50 messages
      'includebody': 'true'
    })
    
    // Fetch messages from Yahoo
    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401) {
        // Try to refresh token if we have a refresh token
        if (connection.refresh_token) {
          const newTokens = await refreshYahooToken(connection.refresh_token)
          if (newTokens) {
            // Update tokens in database
            await updateConnectionTokens(connection.id, newTokens)
            // Retry with new token
            return syncYahooEmails({
              ...connection,
              access_token: await encrypt(newTokens.access_token),
              refresh_token: newTokens.refresh_token ? 
                await encrypt(newTokens.refresh_token) : connection.refresh_token
            })
          }
        }
      }
      throw new Error(`Yahoo API error: ${response.status}`)
    }
    
    const data = await response.json()
    const messages = data.messages || []
    const emails = []
    
    // Process each message
    for (const message of messages) {
      // Skip if already read or in trash/spam
      if (message.flags?.seen || message.folder?.name === 'Trash' || message.folder?.name === 'Spam') {
        continue
      }
      
      // Extract email details
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = message.headers?.find((h: any) => h.name === 'From')?.value || ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subject = message.headers?.find((h: any) => h.name === 'Subject')?.value || ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const date = message.headers?.find((h: any) => h.name === 'Date')?.value || message.receivedDate
      
      // Parse from field
      const fromMatch = from.match(/(.*?)<(.*?)>/)
      const fromName = fromMatch ? fromMatch[1].trim() : from
      const fromEmail = fromMatch ? fromMatch[2] : from
      
      // Extract body
      let bodyText = ''
      let bodyHtml = ''
      
      if (message.parts) {
        for (const part of message.parts) {
          if (part.type === 'text/plain' && part.text) {
            bodyText = part.text
          } else if (part.type === 'text/html' && part.text) {
            bodyHtml = part.text
          }
        }
      } else if (message.body) {
        if (message.body.type === 'text/html') {
          bodyHtml = message.body.text || ''
        } else {
          bodyText = message.body.text || ''
        }
      }
      
      emails.push({
        id: message.id,
        threadId: message.conversationId || message.id,
        from: {
          name: fromName,
          email: fromEmail
        },
        subject,
        bodyText,
        bodyHtml,
        receivedAt: new Date(date).toISOString()
      })
    }
    
    return emails
  } catch (error) {
    console.error('Error syncing Yahoo emails:', error)
    throw error
  }
}

// Helper function to refresh Yahoo token
async function refreshYahooToken(refreshToken: string) {
  try {
    const clientId = process.env.YAHOO_CLIENT_ID
    const clientSecret = process.env.YAHOO_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      console.error('Yahoo OAuth credentials not configured')
      return null
    }
    
    const decryptedRefreshToken = await decrypt(refreshToken)
    
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefreshToken,
      grant_type: 'refresh_token'
    })
    
    const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    })
    
    if (!response.ok) {
      console.error('Failed to refresh Yahoo token')
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error refreshing Yahoo token:', error)
    return null
  }
}

// Helper function to update connection tokens
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateConnectionTokens(connectionId: string, tokens: any) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = {
    access_token: await encrypt(tokens.access_token),
    token_expiry: tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null
  }
  
  if (tokens.refresh_token) {
    updates.refresh_token = await encrypt(tokens.refresh_token)
  }
  
  await supabase
    .from('email_connections')
    .update(updates)
    .eq('id', connectionId)
}

// Outlook sync function using Microsoft Graph API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOutlookEmails(connection: Record<string, any>) {
  try {
    const accessToken = await decrypt(connection.access_token)
    
    // Calculate date filter (last sync or last 7 days)
    const after = connection.last_sync_at 
      ? new Date(connection.last_sync_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    // Microsoft Graph API endpoint for fetching messages
    const filterDate = after.toISOString()
    const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${filterDate} and isRead eq false&$top=50&$select=id,conversationId,subject,from,bodyPreview,body,receivedDateTime&$orderby=receivedDateTime desc`
    
    // Fetch messages from Outlook
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401 && connection.refresh_token) {
        const newTokens = await refreshOutlookToken(connection.refresh_token)
        if (newTokens) {
          // Update tokens in database
          await updateConnectionTokens(connection.id, newTokens)
          // Retry with new token
          return syncOutlookEmails({
            ...connection,
            access_token: await encrypt(newTokens.access_token),
            refresh_token: newTokens.refresh_token ? 
              await encrypt(newTokens.refresh_token) : connection.refresh_token
          })
        }
      }
      throw new Error(`Outlook API error: ${response.status}`)
    }
    
    const data = await response.json()
    const messages = data.value || []
    const emails = []
    
    // Process each message
    for (const message of messages) {
      // Skip if in deleted items or junk folders
      if (message.parentFolderId === 'deleteditems' || message.parentFolderId === 'junkemail') {
        continue
      }
      
      const fromName = message.from?.emailAddress?.name || ''
      const fromEmail = message.from?.emailAddress?.address || ''
      
      emails.push({
        id: message.id,
        threadId: message.conversationId,
        from: {
          name: fromName,
          email: fromEmail
        },
        subject: message.subject || '',
        bodyText: message.bodyPreview || '',
        bodyHtml: message.body?.content || '',
        receivedAt: message.receivedDateTime
      })
    }
    
    return emails
  } catch (error) {
    console.error('Error syncing Outlook emails:', error)
    throw error
  }
}

// Helper function to refresh Outlook token
async function refreshOutlookToken(refreshToken: string) {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      console.error('Microsoft OAuth credentials not configured')
      return null
    }
    
    const decryptedRefreshToken = await decrypt(refreshToken)
    
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefreshToken,
      grant_type: 'refresh_token'
    })
    
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    })
    
    if (!response.ok) {
      console.error('Failed to refresh Outlook token')
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error refreshing Outlook token:', error)
    return null
  }
}