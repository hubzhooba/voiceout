import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAutoReplyWithRates } from '@/lib/ai/email-auto-reply'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { inquiryId } = await request.json()

    if (!inquiryId) {
      return NextResponse.json({ error: 'Inquiry ID required' }, { status: 400 })
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the inquiry details
    const { data: inquiry, error: inquiryError } = await supabase
      .from('email_inquiries')
      .select(`
        *,
        email_connections (
          email_address,
          email_provider,
          tent_id
        )
      `)
      .eq('id', inquiryId)
      .single()

    if (inquiryError || !inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    }

    // Check if auto-reply already sent
    if (inquiry.auto_reply_sent) {
      return NextResponse.json({ 
        error: 'Auto-reply already sent for this inquiry' 
      }, { status: 400 })
    }

    // Get user rates
    const { data: userRates, error: ratesError } = await supabase
      .from('user_rates')
      .select('*')
      .eq('user_id', user.id)
      .eq('tent_id', inquiry.email_connections.tent_id)
      .single()

    if (ratesError || !userRates) {
      return NextResponse.json({ 
        error: 'Please configure your rates first' 
      }, { status: 400 })
    }

    // Check if auto-reply is enabled
    if (!userRates.auto_reply_enabled) {
      return NextResponse.json({ 
        error: 'Auto-reply is not enabled' 
      }, { status: 400 })
    }

    // Check seriousness score threshold
    if (inquiry.seriousness_score < userRates.min_seriousness_score) {
      return NextResponse.json({ 
        error: `Inquiry seriousness score (${inquiry.seriousness_score}) is below minimum threshold (${userRates.min_seriousness_score})` 
      }, { status: 400 })
    }

    // Generate the auto-reply with rates
    const replyBody = await generateAutoReplyWithRates(inquiry, userRates)

    // Log the auto-reply
    const { data: replyLog, error: logError } = await supabase
      .from('auto_reply_log')
      .insert({
        inquiry_id: inquiryId,
        user_id: user.id,
        tent_id: inquiry.email_connections.tent_id,
        reply_subject: `Re: ${inquiry.subject}`,
        reply_body: replyBody,
        reply_status: 'queued'
      })
      .select()
      .single()

    if (logError) throw logError

    // Mark inquiry as auto-replied
    await supabase
      .from('email_inquiries')
      .update({
        auto_reply_sent: true,
        auto_reply_sent_at: new Date().toISOString(),
        status: 'replied'
      })
      .eq('id', inquiryId)

    // TODO: Actually send the email via email service
    // This would integrate with your email sending service (SendGrid, etc.)

    return NextResponse.json({
      success: true,
      replyId: replyLog.id,
      replyBody: replyBody
    })
  } catch (error) {
    console.error('Error sending auto-reply:', error)
    return NextResponse.json(
      { error: 'Failed to send auto-reply' },
      { status: 500 }
    )
  }
}

// Get auto-reply history
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tentId = searchParams.get('tentId')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = supabase
      .from('auto_reply_log')
      .select(`
        *,
        email_inquiries (
          subject,
          from_email,
          from_name,
          received_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tentId) {
      query.eq('tent_id', tentId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ replies: data })
  } catch (error) {
    console.error('Error fetching auto-reply history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-reply history' },
      { status: 500 }
    )
  }
}