import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import * as Imap from 'node-imap'
import { simpleParser } from 'mailparser'
import { analyzeEmailInquiry } from '@/lib/ai/email-analyzer'

interface ParsedEmail {
  from?: string
  subject?: string
  text?: string
  html?: string
  date?: Date
  messageId?: string
}

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

    // Decrypt the app password
    const appPassword = connection.refresh_token ? await decrypt(connection.refresh_token) : null

    if (!appPassword) {
      return NextResponse.json(
        { error: 'App password not found' },
        { status: 400 }
      )
    }

    // Fetch emails using IMAP
    const emails = await fetchYahooEmails(connection.email_address, appPassword)
    
    // Process emails and create inquiries
    let inquiriesCreated = 0
    
    for (const email of emails) {
      // Check if we already have this email
      const { data: existing } = await supabase
        .from('email_inquiries')
        .select('id')
        .eq('email_message_id', email.messageId)
        .single()

      if (!existing) {
        // Analyze with AI
        const analysis = await analyzeEmailInquiry({
          from: email.from || '',
          subject: email.subject || '',
          body: email.text || email.html || ''
        })

        // Only create inquiry if it's a business inquiry
        if (analysis.isBusinessInquiry && analysis.seriousnessScore >= 7) {
          const { error: insertError } = await supabase
            .from('email_inquiries')
            .insert({
              email_connection_id: connectionId,
              tent_id: connection.tent_id,
              sender_email: email.from || '',
              subject: email.subject || '',
              body: email.text || email.html || '',
              received_at: email.date || new Date().toISOString(),
              email_message_id: email.messageId,
              is_business_inquiry: analysis.isBusinessInquiry,
              seriousness_score: analysis.seriousnessScore,
              inquiry_type: analysis.inquiryType,
              ai_summary: analysis.summary,
              status: 'pending_review'
            })

          if (!insertError) {
            inquiriesCreated++
          }
        }
      }
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
      inquiriesCreated
    })
  } catch (error) {
    console.error('Error syncing Yahoo emails:', error)
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    )
  }
}

async function fetchYahooEmails(email: string, appPassword: string): Promise<ParsedEmail[]> {
  return new Promise((resolve, reject) => {
    const emails: ParsedEmail[] = []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imap = new (Imap as any)({
      user: email,
      password: appPassword,
      host: 'imap.mail.yahoo.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    })

    imap.once('ready', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      imap.openBox('INBOX', true, (err: Error, _box: any) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        // Fetch emails from the last 7 days
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const searchCriteria = [
          ['SINCE', sevenDaysAgo.toISOString().split('T')[0]]
        ]

        imap.search(searchCriteria, (err: Error, results: number[]) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }

          // Limit to latest 50 emails
          const messagesToFetch = results.slice(-50)
          
          const fetch = imap.fetch(messagesToFetch, {
            bodies: '',
            markSeen: false
          })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetch.on('message', (msg: any) => {
            let emailBuffer = ''
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            msg.on('body', (stream: any) => {
              stream.on('data', (chunk: Buffer) => {
                emailBuffer += chunk.toString('utf8')
              })
            })

            msg.once('end', () => {
              simpleParser(emailBuffer, (err, parsed) => {
                if (!err && parsed) {
                  emails.push({
                    from: parsed.from?.text,
                    subject: parsed.subject,
                    text: parsed.text,
                    html: typeof parsed.html === 'string' ? parsed.html : undefined,
                    date: parsed.date,
                    messageId: parsed.messageId
                  })
                }
              })
            })
          })

          fetch.once('error', (err: Error) => {
            imap.end()
            reject(err)
          })

          fetch.once('end', () => {
            imap.end()
            resolve(emails)
          })
        })
      })
    })

    imap.once('error', (err: Error) => {
      reject(err)
    })

    imap.connect()
  })
}