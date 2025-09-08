import OpenAI from 'openai'

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

interface ServiceRate {
  service: string
  rate: number
  currency: string
  notes?: string
}

interface UserRates {
  service_rates: ServiceRate[]
  default_currency: string
  reply_template: string
  email_signature: string
  additional_notes?: string
}

interface EmailInquiry {
  from_email: string
  from_name: string
  subject: string
  body_text: string
  ai_summary: string
  inquiry_type: string
}

export async function generateAutoReplyWithRates(
  inquiry: EmailInquiry,
  userRates: UserRates
): Promise<string> {
  try {
    // Format service rates for display
    const formattedRates = formatServiceRates(userRates.service_rates, userRates.default_currency)
    
    // Replace template variables
    let replyBody = userRates.reply_template
    replyBody = replyBody.replace('{{service_rates}}', formattedRates)
    
    // If OpenAI is configured, enhance the reply
    if (openai) {
      const enhancedReply = await enhanceReplyWithAI(inquiry, replyBody, userRates)
      if (enhancedReply) {
        replyBody = enhancedReply
      }
    }
    
    // Add signature
    replyBody += `\n\n${userRates.email_signature}`
    
    // Add additional notes if any
    if (userRates.additional_notes) {
      replyBody += `\n\nP.S. ${userRates.additional_notes}`
    }
    
    return replyBody
  } catch (error) {
    console.error('Error generating auto-reply:', error)
    throw error
  }
}

function formatServiceRates(rates: ServiceRate[], defaultCurrency: string): string {
  if (!rates || rates.length === 0) {
    return 'Please contact me for current rates.'
  }
  
  const formatted = rates.map(rate => {
    const currency = rate.currency || defaultCurrency
    const formattedAmount = formatCurrency(rate.rate, currency)
    let line = `• ${rate.service} - ${formattedAmount}`
    if (rate.notes) {
      line += ` (${rate.notes})`
    }
    return line
  }).join('\n')
  
  return formatted
}

function formatCurrency(amount: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    'PHP': '₱',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'KRW': '₩',
    'INR': '₹'
  }
  
  const symbol = currencySymbols[currency] || currency + ' '
  return `${symbol}${amount.toLocaleString()}`
}

async function enhanceReplyWithAI(
  inquiry: EmailInquiry,
  baseReply: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userRates: UserRates
): Promise<string | null> {
  if (!openai) return null
  
  try {
    const prompt = `
    You are helping a content creator/influencer reply to a business inquiry.
    
    Original Inquiry:
    From: ${inquiry.from_name} (${inquiry.from_email})
    Subject: ${inquiry.subject}
    Body: ${inquiry.body_text}
    Summary: ${inquiry.ai_summary}
    Type: ${inquiry.inquiry_type}
    
    Base Reply Template with Rates:
    ${baseReply}
    
    Please enhance this reply to:
    1. Address specific points mentioned in the inquiry
    2. Maintain a professional but friendly tone
    3. Keep all the rate information intact
    4. Add relevant details based on the inquiry type
    5. Make it personalized to the sender
    6. If they mentioned specific platforms or deliverables, acknowledge them
    7. Keep the response concise and to the point
    
    Return only the enhanced reply body text, no explanations.
    `
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional assistant helping content creators respond to business inquiries. Maintain their rates and pricing exactly as provided.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
    
    const enhancedReply = response.choices[0].message.content
    return enhancedReply || baseReply
  } catch (error) {
    console.error('Error enhancing reply with AI:', error)
    return null
  }
}

// Function to send auto-reply via email service
export async function sendAutoReply(
  toEmail: string,
  subject: string,
  body: string,
  fromEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, this is a placeholder
    
    // Example SendGrid implementation:
    // const sgMail = require('@sendgrid/mail')
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    // 
    // const msg = {
    //   to: toEmail,
    //   from: fromEmail,
    //   subject: subject,
    //   text: body,
    //   html: body.replace(/\n/g, '<br>')
    // }
    // 
    // await sgMail.send(msg)
    
    console.log('Auto-reply would be sent:', {
      to: toEmail,
      from: fromEmail,
      subject: subject,
      bodyLength: body.length
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error sending auto-reply:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
}