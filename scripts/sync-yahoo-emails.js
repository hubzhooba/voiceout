const { createClient } = require('@supabase/supabase-js')
const Imap = require('node-imap')
const { simpleParser } = require('mailparser')
const crypto = require('crypto')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Decryption function (matches the app's encryption.ts)
function decrypt(text) {
  try {
    // Create key by hashing the ENCRYPTION_KEY (same as getKey() in encryption.ts)
    const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest()
    
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift(), 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      key,
      iv
    )
    
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString()
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

async function fetchYahooEmails(email, appPassword) {
  return new Promise((resolve, reject) => {
    const emails = []
    
    const imap = new Imap({
      user: email,
      password: appPassword,
      host: 'imap.mail.yahoo.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        // Fetch emails from the last 2 days
        const twoDaysAgo = new Date()
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
        
        const searchCriteria = [
          ['SINCE', twoDaysAgo.toISOString().split('T')[0]],
          'UNSEEN' // Only unread emails
        ]

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }

          // Limit to latest 20 emails
          const messagesToFetch = results.slice(-20)
          
          const fetch = imap.fetch(messagesToFetch, {
            bodies: '',
            markSeen: false
          })

          let pending = messagesToFetch.length

          fetch.on('message', (msg) => {
            let emailBuffer = ''
            
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                emailBuffer += chunk.toString('utf8')
              })
            })

            msg.once('end', () => {
              simpleParser(emailBuffer, async (err, parsed) => {
                if (!err && parsed) {
                  emails.push({
                    from: parsed.from?.text || '',
                    subject: parsed.subject || '',
                    text: parsed.text || '',
                    html: parsed.html || '',
                    date: parsed.date || new Date(),
                    messageId: parsed.messageId
                  })
                }
                
                pending--
                if (pending === 0) {
                  imap.end()
                  resolve(emails)
                }
              })
            })
          })

          fetch.once('error', (err) => {
            imap.end()
            reject(err)
          })

          fetch.once('end', () => {
            if (pending === 0) {
              imap.end()
              resolve(emails)
            }
          })
        })
      })
    })

    imap.once('error', (err) => {
      reject(err)
    })

    imap.connect()
  })
}

async function syncAllYahooConnections() {
  try {
    console.log('Starting Yahoo email sync...')
    
    // Get all active Yahoo connections
    const { data: connections, error } = await supabase
      .from('email_connections')
      .select('*')
      .eq('email_provider', 'yahoo')
      .eq('is_active', true)
    
    if (error) {
      console.error('Error fetching connections:', error)
      return
    }
    
    console.log(`Found ${connections.length} Yahoo connections to sync`)
    
    for (const connection of connections) {
      try {
        console.log(`Syncing emails for ${connection.email_address}...`)
        
        // Decrypt app password
        const appPassword = decrypt(connection.refresh_token)
        
        // Fetch emails
        const emails = await fetchYahooEmails(connection.email_address, appPassword)
        console.log(`Fetched ${emails.length} emails`)
        
        // Process each email
        let inquiriesCreated = 0
        
        for (const email of emails) {
          // Skip if no messageId
          if (!email.messageId) {
            console.log('Skipping email without messageId')
            continue
          }
          
          // Check if email already exists
          const { data: existing } = await supabase
            .from('email_inquiries')
            .select('id')
            .eq('email_message_id', email.messageId)
            .single()
          
          if (existing) {
            console.log(`Email already processed: ${email.subject}`)
            continue
          }
          
          // Enhanced business inquiry detection
          const emailContent = (email.subject + ' ' + email.text).toLowerCase()
          const emailSubject = email.subject.toLowerCase()
          
          // Strong indicators in subject line (immediate qualification)
          const strongSubjectKeywords = [
            'collaboration', 'rate inquiry', 'possible collaboration',
            'project inquiry', 'inquiry', 'partnership', 'campaign',
            'brand deal', 'sponsored', 'paid partnership', 'opportunity'
          ]
          
          const hasStrongSubject = strongSubjectKeywords.some(keyword => 
            emailSubject.includes(keyword)
          )
          
          // Business keywords in email body
          const businessKeywords = [
            // Agency/Brand indicators
            'agency', 'brand', 'client', 'campaign', 'marketing',
            'influencer marketing', 'content creator', 'influencer',
            
            // Project/Work terms
            'collaboration', 'partnership', 'sponsor', 'project',
            'opportunity', 'proposal', 'work together', 'brand deal',
            'promotion', 'campaign', 'content creation', 'sow',
            'scope of work', 'deliverables', 'brief', 'requirements',
            
            // Payment/Rate terms
            'rate', 'rates', 'compensation', 'budget', 'paid',
            'payment', 'fee', 'cost', 'pricing', 'quote',
            
            // Platform mentions
            'tiktok', 'instagram', 'facebook', 'youtube', 'reel',
            'post', 'video', 'content', 'boosting rights', 'usage rights',
            
            // Professional communication
            'inquire', 'inquiry', 'interested in', 'reach out',
            'discuss', 'meeting', 'call', 'schedule', 'connect',
            'looking forward', 'get back to you', 'let us know',
            'please let me know', 'would like to', 'feel that your profile'
          ]
          
          // Check if email contains business keywords
          const businessKeywordCount = businessKeywords.filter(keyword => 
            emailContent.includes(keyword)
          ).length
          
          // Check if sender addresses recipient by name (more personal/professional)
          const hasPersonalGreeting = 
            emailContent.includes('hi kaila') || 
            emailContent.includes('hello kaila') ||
            emailContent.includes('dear kaila') ||
            emailContent.includes('hey kaila')
          
          // Check for professional sign-offs
          const hasProfessionalSignoff = 
            emailContent.includes('regards') ||
            emailContent.includes('best regards') ||
            emailContent.includes('sincerely') ||
            emailContent.includes('best,') ||
            emailContent.includes('thank you') ||
            emailContent.includes('thanks')
          
          // Skip common non-business emails
          const spamIndicators = [
            'unsubscribe', 'no-reply', 'noreply', 'newsletter',
            'notification', 'alert', 'automated', 'do not reply',
            'verification', 'confirm your', 'reset password',
            'welcome to', 'thank you for signing up', 'receipt',
            'your order', 'has been shipped', 'tracking number'
          ]
          
          const isSpam = spamIndicators.some(indicator => 
            emailContent.includes(indicator)
          )
          
          // Scoring system for business inquiry detection
          let businessScore = 0
          if (hasStrongSubject) businessScore += 5  // Strong subject = very likely
          if (businessKeywordCount >= 5) businessScore += 3  // Multiple keywords
          else if (businessKeywordCount >= 3) businessScore += 2
          else if (businessKeywordCount >= 1) businessScore += 1
          if (hasPersonalGreeting) businessScore += 2  // Personal greeting
          if (hasProfessionalSignoff) businessScore += 1  // Professional signoff
          if (isSpam) businessScore -= 5  // Spam indicators
          
          // Consider it a business inquiry if score is 3 or higher
          const isBusinessInquiry = businessScore >= 3
          
          // For testing: Save ALL emails with lower scores for non-business
          const saveAllForTesting = false // Set to true to see all emails
          
          // Calculate seriousness score (1-10)
          let seriousnessScore = Math.min(10, Math.max(1, businessScore))
          
          // Determine inquiry type based on content
          let inquiryType = 'general'
          if (emailContent.includes('sponsor') || emailContent.includes('paid')) {
            inquiryType = 'sponsorship'
          } else if (emailContent.includes('collaboration') || emailContent.includes('work together')) {
            inquiryType = 'collaboration'
          } else if (emailContent.includes('book') || emailContent.includes('event')) {
            inquiryType = 'booking'
          } else if (!isBusinessInquiry) {
            inquiryType = 'spam'
          }
          
          console.log(`Email: "${email.subject.substring(0, 50)}..." - Business: ${isBusinessInquiry} (Score: ${businessScore})`)
          
          if (isBusinessInquiry || saveAllForTesting) {
              const { error: insertError } = await supabase
                .from('email_inquiries')
                .insert({
                  email_connection_id: connection.id,
                  tent_id: connection.tent_id,
                  sender_email: email.from,
                  subject: email.subject,
                  body: email.text || email.html,
                  received_at: email.date,
                  email_message_id: email.messageId,
                  is_business_inquiry: isBusinessInquiry,
                  seriousness_score: seriousnessScore,
                  inquiry_type: inquiryType,
                  ai_summary: `${inquiryType.charAt(0).toUpperCase() + inquiryType.slice(1)} inquiry from ${email.from}. Subject: ${email.subject.substring(0, 100)}`,
                  status: isBusinessInquiry ? 'pending_review' : 'archived'
                })
              
              if (!insertError) {
                inquiriesCreated++
              }
            }
          }
        }
        
        // Update last sync
        await supabase
          .from('email_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_status: 'active'
          })
          .eq('id', connection.id)
        
        console.log(`Created ${inquiriesCreated} new inquiries for ${connection.email_address}`)
        
      } catch (connError) {
        console.error(`Error syncing ${connection.email_address}:`, connError)
        
        // Update connection with error
        await supabase
          .from('email_connections')
          .update({
            sync_status: 'error',
            error_message: connError.message
          })
          .eq('id', connection.id)
      }
    }
    
    console.log('Yahoo email sync completed!')
    
  } catch (error) {
    console.error('Fatal error in sync:', error)
    process.exit(1)
  }
}

// Run the sync
syncAllYahooConnections()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })