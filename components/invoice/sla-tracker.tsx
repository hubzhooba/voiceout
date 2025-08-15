'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Timer,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'

interface SLAData {
  id: string
  invoice_id: string
  submitted_at: string
  first_viewed_at: string | null
  first_viewed_by: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_type: string | null
  time_to_first_view: number | null
  time_to_resolution: number | null
  sla_deadline: string
  is_sla_met: boolean | null
}

interface SLATrackerProps {
  invoiceId: string
  invoiceStatus: string
  tentSLAHours?: number
}

export function SLATracker({ invoiceId, invoiceStatus, tentSLAHours = 48 }: SLATrackerProps) {
  const [slaData, setSlaData] = useState<SLAData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [progressPercentage, setProgressPercentage] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchSLAData()
    
    // Set up interval to update time remaining
    const interval = setInterval(() => {
      if (slaData && !slaData.resolved_at) {
        updateTimeRemaining()
      }
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  useEffect(() => {
    if (slaData) {
      updateTimeRemaining()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slaData])

  const fetchSLAData = async () => {
    try {
      const { data, error } = await supabase
        .from('sla_tracking')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setSlaData(data)
    } catch (error) {
      console.error('Error fetching SLA data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTimeRemaining = () => {
    if (!slaData) return

    const now = new Date()
    const deadline = new Date(slaData.sla_deadline)
    const submitted = new Date(slaData.submitted_at)
    
    if (slaData.resolved_at) {
      // Already resolved
      setTimeRemaining('Resolved')
      setProgressPercentage(100)
    } else if (now > deadline) {
      // Overdue
      const overdueTime = formatDistanceToNow(deadline, { addSuffix: false })
      setTimeRemaining(`Overdue by ${overdueTime}`)
      setProgressPercentage(100)
    } else {
      // Still within SLA
      const totalMinutes = differenceInMinutes(deadline, submitted)
      const elapsedMinutes = differenceInMinutes(now, submitted)
      const remainingTime = formatDistanceToNow(deadline, { addSuffix: false })
      
      setTimeRemaining(`${remainingTime} remaining`)
      setProgressPercentage(Math.min((elapsedMinutes / totalMinutes) * 100, 100))
    }
  }

  const getSLAStatus = () => {
    if (!slaData) return 'pending'
    
    if (slaData.resolved_at) {
      return slaData.is_sla_met ? 'met' : 'breached'
    }
    
    const now = new Date()
    const deadline = new Date(slaData.sla_deadline)
    
    if (now > deadline) return 'overdue'
    
    const totalMinutes = tentSLAHours * 60
    const elapsedMinutes = differenceInMinutes(now, new Date(slaData.submitted_at))
    const percentageUsed = (elapsedMinutes / totalMinutes) * 100
    
    if (percentageUsed > 75) return 'warning'
    return 'on-track'
  }

  const getStatusColor = () => {
    const status = getSLAStatus()
    switch (status) {
      case 'met': return 'text-green-600 bg-green-100'
      case 'breached': return 'text-red-600 bg-red-100'
      case 'overdue': return 'text-red-600 bg-red-100'
      case 'warning': return 'text-amber-600 bg-amber-100'
      case 'on-track': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = () => {
    const status = getSLAStatus()
    switch (status) {
      case 'met': return <CheckCircle className="h-4 w-4" />
      case 'breached': return <XCircle className="h-4 w-4" />
      case 'overdue': return <XCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'on-track': return <Clock className="h-4 w-4" />
      default: return <Timer className="h-4 w-4" />
    }
  }

  const getProgressColor = () => {
    const status = getSLAStatus()
    switch (status) {
      case 'met': return 'bg-green-500'
      case 'breached': return 'bg-red-500'
      case 'overdue': return 'bg-red-500'
      case 'warning': return 'bg-amber-500'
      case 'on-track': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!slaData && invoiceStatus !== 'submitted') {
    return null // Don't show SLA tracker for draft invoices
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary-600" />
          SLA Tracking
        </h3>
        <Badge className={`${getStatusColor()} flex items-center gap-1`}>
          {getStatusIcon()}
          <span className="capitalize">{getSLAStatus().replace('-', ' ')}</span>
        </Badge>
      </div>

      {slaData ? (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">SLA Progress</span>
              <span className="font-medium">{timeRemaining}</span>
            </div>
            <div className="relative">
              <Progress 
                value={progressPercentage} 
                className="h-3"
              />
              <div 
                className={`absolute inset-0 h-3 rounded-full ${getProgressColor()} opacity-20`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Submitted</span>
              <span>SLA: {tentSLAHours} hours</span>
              <span>Deadline</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Invoice Submitted</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(slaData.submitted_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {slaData.first_viewed_at && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Eye className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">First Viewed</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(slaData.first_viewed_at), { addSuffix: true })}
                    {slaData.time_to_first_view && (
                      <span className="ml-2">
                        ({Math.round(slaData.time_to_first_view)} min response time)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {slaData.resolved_at && (
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  slaData.resolution_type === 'approved' 
                    ? 'bg-green-100' 
                    : 'bg-red-100'
                }`}>
                  {slaData.resolution_type === 'approved' 
                    ? <CheckCircle className="h-4 w-4 text-green-600" />
                    : <XCircle className="h-4 w-4 text-red-600" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">
                    Invoice {slaData.resolution_type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(slaData.resolved_at), { addSuffix: true })}
                    {slaData.time_to_resolution && (
                      <span className="ml-2">
                        ({Math.round(slaData.time_to_resolution / 60)} hours total time)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SLA Metrics */}
          {slaData.resolved_at && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {slaData.is_sla_met ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <p className="text-2xl font-bold">
                    {slaData.time_to_resolution 
                      ? Math.round(slaData.time_to_resolution / 60)
                      : 0}h
                  </p>
                </div>
                <p className="text-xs text-gray-600">Resolution Time</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <p className="text-2xl font-bold">{tentSLAHours}h</p>
                </div>
                <p className="text-xs text-gray-600">SLA Target</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Timer className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>SLA tracking will begin when invoice is submitted</p>
        </div>
      )}
    </motion.div>
  )
}

import { Eye } from 'lucide-react'