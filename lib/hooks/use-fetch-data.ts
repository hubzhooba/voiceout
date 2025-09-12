import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface UseFetchDataOptions {
  table: string
  select?: string
  filters?: Record<string, any>
  orderBy?: { column: string; ascending?: boolean }
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

export function useFetchData<T = any>({
  table,
  select = '*',
  filters = {},
  orderBy,
  onSuccess,
  onError,
  enabled = true
}: UseFetchDataOptions) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClient()
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    if (!enabled) return
    
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase.from(table).select(select)
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })
      
      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
      }
      
      const { data: result, error: fetchError } = await query
      
      if (fetchError) throw fetchError
      
      setData(result as T)
      onSuccess?.(result)
    } catch (err) {
      const error = err as Error
      setError(error)
      onError?.(error)
      
      toast({
        title: 'Error fetching data',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [table, select, filters, orderBy, enabled, supabase, toast, onSuccess, onError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}

// Specialized hooks for common entities
export function useFetchProjects(tentId?: string) {
  return useFetchData({
    table: 'projects',
    select: '*, tents(name), workflow_step, step1_status, step2_status, step3_status, step4_status, step5_status',
    filters: tentId ? { tent_id: tentId } : {},
    orderBy: { column: 'created_at', ascending: false }
  })
}

export function useFetchTents(userId: string) {
  return useFetchData({
    table: 'tent_members',
    select: `
      tent_id,
      tent_role,
      is_admin,
      tents (
        id,
        name,
        description,
        is_locked,
        invite_code
      )
    `,
    filters: { user_id: userId },
    orderBy: { column: 'created_at', ascending: false }
  })
}

export function useFetchNotifications(userId: string) {
  return useFetchData({
    table: 'notifications',
    select: '*',
    filters: { user_id: userId, read: false },
    orderBy: { column: 'created_at', ascending: false }
  })
}