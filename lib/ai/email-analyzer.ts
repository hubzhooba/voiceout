import OpenAI from 'openai'

// Initialize OpenAI client - handle missing API key during build time
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export interface EmailAnalysis {
  isBusinessInquiry: boolean
  seriousnessScore: number // 1-10
  inquiryType: 'collaboration' | 'booking' | 'sponsorship' | 'general' | 'spam'
  summary: string
}

export async function analyzeEmailInquiry(email: {
  from: string
  subject: string
  body: string
}): Promise<EmailAnalysis> {
  try {
    // Return default analysis if OpenAI is not configured
    if (!openai) {
      console.warn('OpenAI API key not configured - returning default analysis')
      return {
        isBusinessInquiry: false,
        seriousnessScore: 1,
        inquiryType: 'general',
        summary: 'AI analysis unavailable - OpenAI not configured'
      }
    }
    const prompt = `
    Analyze this email and determine if it's a legitimate business inquiry for a content creator/influencer.
    
    From: ${email.from}
    Subject: ${email.subject}
    Body: ${email.body}
    
    Please analyze and return a JSON object with the following structure:
    {
      "isBusinessInquiry": boolean (true if this appears to be a genuine business inquiry),
      "seriousnessScore": number (1-10, where 10 is extremely serious/professional),
      "inquiryType": string (one of: collaboration, booking, sponsorship, general, spam),
      "summary": string (2-3 sentence summary of the opportunity)
    }
    
    Consider these factors for legitimacy and importance:
    - Professional tone and clear business proposal
    - Specific details about collaboration/project
    - Company information and contact details
    - Budget or compensation mentioned
    - Timeline and deliverables specified
    - Alignment with creator content
    
    Filter out:
    - Generic spam or mass emails
    - Scams or suspicious requests
    - Personal messages (not business)
    - Newsletter subscriptions
    - Automated notifications
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant specialized in analyzing business emails for content creators and influencers. You help filter legitimate business opportunities from spam and irrelevant messages.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const result = response.choices[0].message.content
    if (!result) {
      throw new Error('No response from AI')
    }

    const analysis = JSON.parse(result)
    return {
      isBusinessInquiry: analysis.isBusinessInquiry || false,
      seriousnessScore: Math.min(10, Math.max(1, analysis.seriousnessScore || 1)),
      inquiryType: analysis.inquiryType || 'general',
      summary: analysis.summary || 'No summary available'
    }
  } catch (error) {
    console.error('Error analyzing email with AI:', error)
    
    // Return a default analysis on error
    return {
      isBusinessInquiry: false,
      seriousnessScore: 1,
      inquiryType: 'general',
      summary: 'Could not analyze email'
    }
  }
}

// Function to generate smart reply suggestions
export async function generateReplySuggestions(inquiry: {
  subject: string
  ai_summary: string
  inquiry_type: string
  sentiment_score: number
}): Promise<{
  accept: string
  needMoreInfo: string
  decline: string
}> {
  try {
    // Return default templates if OpenAI is not configured
    if (!openai) {
      console.warn('OpenAI API key not configured - returning default templates')
      return {
        accept: "Thank you for reaching out! I'm very interested in this opportunity and would love to discuss the details further. Please let me know your availability for a call or meeting to explore how we can work together.",
        needMoreInfo: "Thank you for your inquiry. I'm interested in learning more about this opportunity. Could you please provide additional details about the project scope, timeline, and budget? I look forward to hearing from you.",
        decline: "Thank you for considering me for this opportunity. Unfortunately, I'm unable to take on this project at this time due to current commitments. I wish you the best of luck with your project."
      }
    }
    const prompt = `
    Generate three professional email reply templates for this business inquiry:
    
    Inquiry Summary: ${inquiry.ai_summary}
    Type: ${inquiry.inquiry_type}
    Original Subject: ${inquiry.subject}
    
    Please provide three reply options:
    1. Accept/Show Interest - Professional and enthusiastic acceptance
    2. Need More Information - Polite request for clarification/details
    3. Decline - Professional and courteous rejection
    
    Each reply should be 3-4 sentences, professional, and appropriate for a content creator/influencer.
    
    Return as JSON:
    {
      "accept": "reply text",
      "needMoreInfo": "reply text",
      "decline": "reply text"
    }
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional email writer for content creators and influencers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const result = response.choices[0].message.content
    if (!result) {
      throw new Error('No response from AI')
    }

    return JSON.parse(result)
  } catch (error) {
    console.error('Error generating reply suggestions:', error)
    
    // Return default templates
    return {
      accept: "Thank you for reaching out! I'm very interested in this opportunity and would love to discuss the details further. Please let me know your availability for a call or meeting to explore how we can work together.",
      needMoreInfo: "Thank you for your inquiry. I'm interested in learning more about this opportunity. Could you please provide additional details about the project scope, timeline, and budget? I look forward to hearing from you.",
      decline: "Thank you for considering me for this opportunity. Unfortunately, I'm unable to take on this project at this time due to current commitments. I wish you the best of luck with your project."
    }
  }
}