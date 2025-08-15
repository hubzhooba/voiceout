'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  FileText, 
  CheckCircle, 
  XCircle,
  Edit,
  Plus,
  Trash,
  Eye,
  Clock
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface AuditEntry {
  id: string
  tent_id: string
  user_id: string
  entity_type: string
  entity_id: string
  action: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any
  ip_address: string | null
  user_agent: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface InvoiceRevision {
  id: string
  invoice_id: string
  revision_number: number
  changed_by: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  previous_data: any
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface AuditTrailProps {
  invoiceId: string
  tentId: string
}

export function AuditTrail({ invoiceId, tentId }: AuditTrailProps) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [revisions, setRevisions] = useState<InvoiceRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'audit' | 'revisions'>('audit')
  const supabase = createClient()

  useEffect(() => {
    fetchAuditData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, tentId])

  const fetchAuditData = async () => {
    try {
      // Fetch audit trail
      const { data: auditData, error: auditError } = await supabase
        .from('audit_trail')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .or(`entity_id.eq.${invoiceId},tent_id.eq.${tentId}`)
        .order('created_at', { ascending: false })

      if (auditError) throw auditError
      setAuditEntries(auditData || [])

      // Fetch revisions
      const { data: revisionData, error: revisionError } = await supabase
        .from('invoice_revisions')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .eq('invoice_id', invoiceId)
        .order('revision_number', { ascending: false })

      if (revisionError) throw revisionError
      setRevisions(revisionData || [])
    } catch (error) {
      console.error('Error fetching audit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'insert':
      case 'create':
        return <Plus className="h-4 w-4 text-green-500" />
      case 'update':
      case 'edit':
        return <Edit className="h-4 w-4 text-blue-500" />
      case 'delete':
        return <Trash className="h-4 w-4 text-red-500" />
      case 'approve':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'reject':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'view':
        return <Eye className="h-4 w-4 text-gray-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getActionLabel = (action: string, entityType: string) => {
    const actionMap: Record<string, string> = {
      'INSERT': 'created',
      'UPDATE': 'updated',
      'DELETE': 'deleted',
    }
    
    return `${actionMap[action] || action.toLowerCase()} ${entityType.replace('_', ' ')}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatChanges = (changes: any) => {
    if (!changes || typeof changes !== 'object') return []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.entries(changes).map(([field, value]: [string, any]) => ({
      field: field.replace(/_/g, ' '),
      old: value?.old,
      new: value?.new
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUserName = (profile: any) => {
    return profile?.full_name || profile?.email || 'Unknown User'
  }

  if (loading) {
    return (
      <div className="glass-card p-6 h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary-600" />
          Activity & History
        </h3>
        
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'audit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('audit')}
            className={activeTab === 'audit' ? 'btn-primary text-sm' : 'btn-glass text-sm'}
          >
            Activity Log
          </Button>
          <Button
            variant={activeTab === 'revisions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('revisions')}
            className={activeTab === 'revisions' ? 'btn-primary text-sm' : 'btn-glass text-sm'}
          >
            Revisions ({revisions.length})
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        {activeTab === 'audit' ? (
          <div className="space-y-3">
            {auditEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No activity recorded yet</p>
              </div>
            ) : (
              auditEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3 p-3 bg-white/30 rounded-lg hover:bg-white/40 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(entry.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          <span className="text-gray-700">{getUserName(entry.profiles)}</span>
                          {' '}
                          <span className="text-gray-600">
                            {getActionLabel(entry.action, entry.entity_type)}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                          </p>
                          {entry.ip_address && (
                            <>
                              <span className="text-gray-400">•</span>
                              <p className="text-xs text-gray-500">
                                IP: {entry.ip_address}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {revisions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No revisions yet</p>
              </div>
            ) : (
              revisions.map((revision) => {
                const changes = formatChanges(revision.changes)
                
                return (
                  <motion.div
                    key={revision.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/30 rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="badge-glass">
                            Revision #{revision.revision_number}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            by {getUserName(revision.profiles)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(revision.created_at), 'PPpp')}
                        </p>
                      </div>
                    </div>

                    {changes.length > 0 && (
                      <div className="space-y-2 pl-4 border-l-2 border-gray-300">
                        {changes.map((change, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium capitalize">{change.field}:</span>
                            <div className="flex items-center gap-2 text-xs mt-1">
                              <span className="text-red-600 line-through">
                                {change.old || 'empty'}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600">
                                {change.new || 'empty'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )
              })
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// Import Button type
import { Button } from '@/components/ui/button'