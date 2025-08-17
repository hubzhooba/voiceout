'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { OptimizedButton as Button } from '@/components/ui/optimized-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation'
import { CreateTentDialog } from '@/components/tents/create-tent-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tent,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogIn,
  Copy,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

interface TentData {
  id: string
  name: string
  description: string | null
  is_locked: boolean
  invite_code: string
  tent_members: Array<{
    user_id: string
    tent_role: string
    is_admin: boolean
  }>
}

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  total_amount: number
  amount?: number
  status: string
  created_at: string
  tent_id: string
  tents?: {
    name: string
  }
}

interface DashboardStats {
  totalTents: number
  totalInvoices: number
  pendingInvoices: number
  approvedInvoices: number
  totalRevenue: number
}

export function GlassDashboard({ userId }: { userId: string }) {
  const [tents, setTents] = useState<TentData[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalTents: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    approvedInvoices: 0,
    totalRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()
  const { navigate, prefetch } = useOptimizedNavigation()

  const fetchDashboardData = useCallback(async () => {
    try {
      // Batch fetch all data in parallel for better performance
      const [tentsResponse, invoicesResponse] = await Promise.all([
        supabase
          .from('tent_members')
          .select(`
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
          `)
          .eq('user_id', userId),
        supabase
          .from('invoices')
          .select('*, tents(name)')
          .order('created_at', { ascending: false })
          .limit(10)
      ])

      if (tentsResponse.error) throw tentsResponse.error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedTents = tentsResponse.data?.map((item: any) => ({
        id: item.tents.id,
        name: item.tents.name,
        description: item.tents.description,
        is_locked: item.tents.is_locked,
        invite_code: item.tents.invite_code,
        tent_members: [{
          user_id: userId,
          tent_role: item.tent_role,
          is_admin: item.is_admin
        }]
      })) || []

      setTents(formattedTents)

      // Filter invoices to only those from user's tents
      const tentIds = new Set(formattedTents.map(t => t.id))
      const userInvoices = invoicesResponse.data?.filter(inv => tentIds.has(inv.tent_id)) || []
      setInvoices(userInvoices)

      // Calculate stats
      const pending = userInvoices.filter(inv => inv.status === 'submitted')
      const approved = userInvoices.filter(inv => inv.status === 'approved')
      const totalRevenue = approved.reduce((sum, inv) => sum + (Number(inv.total_amount) || Number(inv.amount) || 0), 0)

      setStats({
        totalTents: formattedTents.length,
        totalInvoices: userInvoices.length,
        pendingInvoices: pending.length,
        approvedInvoices: approved.length,
        totalRevenue
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [userId, supabase, toast])

  useEffect(() => {
    fetchDashboardData()
    
    // Debounced update handler to prevent excessive refetches
    let updateTimeout: NodeJS.Timeout
    const handleRealtimeUpdate = () => {
      clearTimeout(updateTimeout)
      updateTimeout = setTimeout(() => {
        fetchDashboardData()
      }, 1000) // Debounce updates by 1 second
    }
    
    // Set up real-time subscription with debouncing
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tent_members',
          filter: `user_id=eq.${userId}`
        },
        handleRealtimeUpdate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        handleRealtimeUpdate
      )
      .subscribe()

    return () => {
      clearTimeout(updateTimeout)
      supabase.removeChannel(channel)
    }
  }, [userId, fetchDashboardData, supabase])

  const handleJoinTent = useCallback(async () => {
    if (joinCode.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter a 6-character invite code',
        variant: 'destructive'
      })
      return
    }

    setJoining(true)
    try {
      const response = await fetch('/api/tents/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join tent')
      }

      // Close dialog immediately for better UX
      setShowJoinDialog(false)
      setJoinCode('')
      
      toast({
        title: 'Success!',
        description: `You've joined ${data.tent.name}`,
      })
      
      // Navigate without blocking
      navigate(`/tents/${data.tent.id}`)
      // Fetch data in background
      fetchDashboardData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join tent',
        variant: 'destructive'
      })
    } finally {
      setJoining(false)
    }
  }, [joinCode, toast, navigate, fetchDashboardData])

  const copyInviteCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
    toast({
      title: 'Copied!',
      description: 'Invite code copied to clipboard',
    })
  }, [toast])

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'submitted':
        return <Clock className="h-4 w-4 text-amber-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }, [])

  const getUserRole = (tent: TentData) => {
    const member = tent.tent_members?.find(m => m.user_id === userId)
    return member?.tent_role || 'member'
  }

  const isAdmin = (tent: TentData) => {
    const member = tent.tent_members?.find(m => m.user_id === userId)
    return member?.is_admin || false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8 custom-scrollbar">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-4xl font-bold gradient-text flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            Dashboard
          </h1>
          <p className="text-gray-600 mt-2 text-shadow">
            Manage your tents and invoices in one place
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Button className="btn-glass">
                <LogIn className="mr-2 h-4 w-4" />
                Join Tent
              </Button>
            </DialogTrigger>
            <DialogContent className="modal-content">
              <DialogHeader>
                <DialogTitle className="gradient-text text-2xl">Join a Tent</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Enter the invite code to join an existing tent
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="invite-code" className="text-gray-700">Invite Code</Label>
                  <Input
                    id="invite-code"
                    className="input-glass mt-2"
                    placeholder="Enter 6-character code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleJoinTent}
                  disabled={joining || joinCode.length !== 6}
                  className="btn-primary"
                >
                  {joining ? 'Joining...' : 'Join Tent'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <CreateTentDialog onTentCreated={fetchDashboardData} />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
      >
        {[
          { title: 'Total Tents', value: stats.totalTents, icon: Tent, color: 'from-blue-500 to-blue-600' },
          { title: 'Total Invoices', value: stats.totalInvoices, icon: FileText, color: 'from-purple-500 to-purple-600' },
          { title: 'Pending', value: stats.pendingInvoices, icon: Clock, color: 'from-amber-500 to-amber-600' },
          { title: 'Approved', value: stats.approvedInvoices, icon: CheckCircle, color: 'from-green-500 to-green-600' },
          { title: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'from-pink-500 to-pink-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            whileHover={{ y: -2 }}
            className="stats-card"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">{stat.title}</p>
              <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color} bg-opacity-10`}>
                <stat.icon className="h-4 w-4 text-white mix-blend-multiply" />
              </div>
            </div>
            <p className="text-2xl font-bold gradient-text-subtle">{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Tabs defaultValue="tents" className="space-y-6">
          <TabsList className="glass-card p-1 w-fit">
            <TabsTrigger value="tents" className="tab-glass data-[state=active]:tab-glass-active">
              <Tent className="h-4 w-4 mr-2" />
              My Tents
            </TabsTrigger>
            <TabsTrigger value="invoices" className="tab-glass data-[state=active]:tab-glass-active">
              <FileText className="h-4 w-4 mr-2" />
              Recent Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tents" className="space-y-4">
            <AnimatePresence>
              {tents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-card p-8 text-center"
                >
                  <Tent className="h-12 w-12 mx-auto mb-4 text-primary-600" />
                  <h3 className="text-xl font-semibold gradient-text mb-2">No Tents Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Create your first tent or join an existing one to get started
                  </p>
                  <div className="flex gap-3 justify-center">
                    <CreateTentDialog onTentCreated={fetchDashboardData} />
                    <Button
                      onClick={() => setShowJoinDialog(true)}
                      className="btn-glass"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Join Tent
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {tents.map((tent, index) => (
                    <motion.div
                      key={tent.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.15) }}
                      whileHover={{ y: -2 }}
                      className="glass-card-hover p-6 cursor-pointer group"
                      onClick={() => navigate(`/tents/${tent.id}`)}
                      onMouseEnter={() => prefetch(`/tents/${tent.id}`)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold gradient-text-subtle group-hover:gradient-text transition-all">
                            {tent.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {tent.description || 'No description'}
                          </p>
                        </div>
                        {isAdmin(tent) && (
                          <span className="badge-glass bg-primary-600/20 text-primary-700">
                            Admin
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Your Role</span>
                          <span className="font-medium capitalize">{getUserRole(tent)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Status</span>
                          <span className={`badge-glass ${tent.is_locked ? 'badge-error' : 'badge-success'}`}>
                            {tent.is_locked ? '🔒 Locked' : '🔓 Open'}
                          </span>
                        </div>
                      </div>

                      {!tent.is_locked && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <div className="flex items-center justify-between">
                            <code className="text-xs bg-white/10 px-2 py-1 rounded">
                              {tent.invite_code}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyInviteCode(tent.invite_code)
                              }}
                              className="hover:bg-white/10"
                              immediateResponse={false}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center text-primary-600 group-hover:text-primary-700">
                        <span className="text-sm font-medium">View Tent</span>
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            {invoices.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 text-center"
              >
                <FileText className="h-12 w-12 mx-auto mb-4 text-primary-600" />
                <h3 className="text-xl font-semibold gradient-text mb-2">No Invoices Yet</h3>
                <p className="text-gray-600">
                  Your invoices will appear here once created
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.1) }}
                    whileHover={{ x: 2 }}
                    className="glass-card-hover p-4 cursor-pointer"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    onMouseEnter={() => prefetch(`/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(invoice.status)}
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-600">
                            {invoice.client_name} • {invoice.tents?.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold gradient-text">
                          ${(invoice.total_amount || invoice.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}