import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tentId = searchParams.get('tentId')
    const targetUserId = request.headers.get('X-Target-User-Id')

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let userIdToFetch = user.id

    // If manager is trying to fetch another user's rates
    if (targetUserId && targetUserId !== user.id && tentId) {
      // Check if current user is a manager in this tent
      const { data: memberData } = await supabase
        .from('tent_members')
        .select('role')
        .eq('tent_id', tentId)
        .eq('user_id', user.id)
        .single()

      if (memberData?.role === 'manager' || memberData?.role === 'owner') {
        // Verify target user is in the same tent
        const { data: targetMember } = await supabase
          .from('tent_members')
          .select('user_id')
          .eq('tent_id', tentId)
          .eq('user_id', targetUserId)
          .single()

        if (targetMember) {
          userIdToFetch = targetUserId
        }
      }
    }

    // Get user rates
    const query = supabase
      .from('user_rates')
      .select('*')
      .eq('user_id', userIdToFetch)

    if (tentId) {
      query.eq('tent_id', tentId)
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    return NextResponse.json({ rates: data })
  } catch (error) {
    console.error('Error fetching rates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const targetUserId = request.headers.get('X-Target-User-Id')

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      tentId,
      serviceRates,
      defaultCurrency = 'PHP',
      autoReplyEnabled = false,
      autoReplyDelayMinutes = 5,
      replyTemplate,
      emailSignature = 'Best regards',
      minSeriousnessScore = 5,
      additionalNotes
    } = body

    let userIdToUpdate = user.id

    // If manager is trying to update another user's rates
    if (targetUserId && targetUserId !== user.id && tentId) {
      // Check if current user is a manager in this tent
      const { data: memberData } = await supabase
        .from('tent_members')
        .select('role')
        .eq('tent_id', tentId)
        .eq('user_id', user.id)
        .single()

      if (memberData?.role === 'manager' || memberData?.role === 'owner') {
        // Verify target user is in the same tent
        const { data: targetMember } = await supabase
          .from('tent_members')
          .select('user_id')
          .eq('tent_id', tentId)
          .eq('user_id', targetUserId)
          .single()

        if (targetMember) {
          userIdToUpdate = targetUserId
        } else {
          return NextResponse.json({ error: 'Target user not in tent' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Only managers can edit other users rates' }, { status: 403 })
      }
    }

    // Check if rates already exist for this user
    const { data: existing } = await supabase
      .from('user_rates')
      .select('id')
      .eq('user_id', userIdToUpdate)
      .eq('tent_id', tentId || null)
      .single()

    let result
    if (existing) {
      // Update existing rates
      result = await supabase
        .from('user_rates')
        .update({
          service_rates: serviceRates,
          default_currency: defaultCurrency,
          auto_reply_enabled: autoReplyEnabled,
          auto_reply_delay_minutes: autoReplyDelayMinutes,
          reply_template: replyTemplate,
          email_signature: emailSignature,
          min_seriousness_score: minSeriousnessScore,
          additional_notes: additionalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Create new rates
      result = await supabase
        .from('user_rates')
        .insert({
          user_id: userIdToUpdate,
          tent_id: tentId || null,
          service_rates: serviceRates,
          default_currency: defaultCurrency,
          auto_reply_enabled: autoReplyEnabled,
          auto_reply_delay_minutes: autoReplyDelayMinutes,
          reply_template: replyTemplate,
          email_signature: emailSignature,
          min_seriousness_score: minSeriousnessScore,
          additional_notes: additionalNotes
        })
        .select()
        .single()
    }

    if (result.error) throw result.error

    return NextResponse.json({ rates: result.data })
  } catch (error) {
    console.error('Error saving rates:', error)
    return NextResponse.json(
      { error: 'Failed to save rates' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tentId = searchParams.get('tentId')

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = supabase
      .from('user_rates')
      .delete()
      .eq('user_id', user.id)

    if (tentId) {
      query.eq('tent_id', tentId)
    }

    const { error } = await query

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rates:', error)
    return NextResponse.json(
      { error: 'Failed to delete rates' },
      { status: 500 }
    )
  }
}