import { createClient } from '@/lib/supabase/client'

export type ActivityType = 
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'member_joined'
  | 'member_left'
  | 'member_role_changed'
  | 'document_uploaded'
  | 'document_deleted'
  | 'invoice_uploaded'
  | 'tent_settings_updated'

export type EntityType = 'project' | 'member' | 'document' | 'invoice' | 'tent'

interface LogActivityParams {
  tentId: string
  actionType: ActivityType
  actionDescription: string
  entityType?: EntityType
  entityId?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an activity to the tent activity logs
 */
export async function logTentActivity({
  tentId,
  actionType,
  actionDescription,
  entityType,
  entityId,
  metadata
}: LogActivityParams) {
  const supabase = createClient()
  
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      console.error('Cannot log activity: user not authenticated')
      return null
    }

    const { data, error } = await supabase
      .from('tent_activity_logs')
      .insert({
        tent_id: tentId,
        user_id: userData.user.id,
        action_type: actionType,
        action_description: actionDescription,
        entity_type: entityType,
        entity_id: entityId,
        metadata
      })
      .select()
      .single()

    if (error) {
      console.error('Error logging activity:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in logTentActivity:', error)
    return null
  }
}

/**
 * Get activity logs for a tent
 */
export async function getTentActivityLogs(
  tentId: string,
  limit = 50,
  offset = 0
) {
  const supabase = createClient()
  
  try {
    // First check if we can fetch logs without the join
    const { data, error } = await supabase
      .from('tent_activity_logs')
      .select('*')
      .eq('tent_id', tentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Check if error is due to missing table
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('Activity logs table not found. Please run the migration: 012_tent_activity_logs.sql')
        return []
      }
      console.error('Error fetching activity logs:', error)
      return []
    }

    // If we have data, try to enrich it with profile information
    if (data && data.length > 0) {
      // Get unique user IDs
      const userIds = [...new Set(data.map(log => log.user_id))].filter(Boolean)
      
      // Fetch profiles separately
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)
      
      // Map profiles to logs
      const enrichedData = data.map(log => ({
        ...log,
        profiles: profiles?.find(p => p.id === log.user_id) || null
      }))
      
      console.log(`Fetched ${enrichedData.length} activity logs for tent ${tentId}`)
      return enrichedData
    }

    console.log(`No activity logs found for tent ${tentId}`)
    return data || []
  } catch (error) {
    console.error('Error in getTentActivityLogs:', error)
    return []
  }
}

/**
 * Get activity logs for specific entity
 */
export async function getEntityActivityLogs(
  entityType: EntityType,
  entityId: string,
  limit = 20
) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('tent_activity_logs')
    .select(`
      *,
      profiles:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching entity activity logs:', error)
    return []
  }

  return data || []
}