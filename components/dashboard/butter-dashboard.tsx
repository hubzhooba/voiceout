'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation'
import { CreateTentDialog } from '@/components/tents/create-tent-dialog'
import {
  Tent,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  LogIn,
  Copy,
  Zap,
  Target,
  Trophy,
  Star,
  Rocket,
  Search,
  Bell,
  Settings,
  User,
  BarChart3,
  DollarSign,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Grid3x3,
  List,
  Moon,
  Sun,
  PlusCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

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
  revenueGrowth: number
  invoiceGrowth: number
  completionRate: number
}

// Greeting messages based on time of day
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return { text: "Good morning", emoji: "☀️" }
  if (hour < 17) return { text: "Good afternoon", emoji: "🌤️" }
  if (hour < 21) return { text: "Good evening", emoji: "🌆" }
  return { text: "Good night", emoji: "🌙" }
}

// Motivational messages
const motivationalMessages = [
  { text: "You're doing amazing!", icon: Star },
  { text: "Keep up the great work!", icon: Trophy },
  { text: "On fire today! 🔥", icon: Zap },
  { text: "Productivity champion!", icon: Rocket },
  { text: "Making it happen!", icon: Target },
]

export function ButterDashboard({ userId, userEmail }: { userId: string, userEmail?: string }) {
  const [tents, setTents] = useState<TentData[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalTents: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    approvedInvoices: 0,
    totalRevenue: 0,
    revenueGrowth: 0,
    invoiceGrowth: 0,
    completionRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [showCreateTentDialog, setShowCreateTentDialog] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [userRole, setUserRole] = useState<'creator' | 'manager'>('creator')
  const [showNotifications, setShowNotifications] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [notifications, setNotifications] = useState<Array<{
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning'
    read: boolean
    created_at: string
  }>>([])
  
  const supabase = createClient()
  const { toast } = useToast()
  const { navigate, prefetch } = useOptimizedNavigation()
  
  const greeting = getGreeting()
  const motivationalMessage = useMemo(() => 
    motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)],
    []
  )

  const fetchDashboardData = useCallback(async () => {
    try {
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

      // Determine user's primary role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasManagerRole = tentsResponse.data?.some((item: any) => item.tent_role === 'manager')
      setUserRole(hasManagerRole ? 'manager' : 'creator')

      const tentIds = new Set(formattedTents.map(t => t.id))
      const userInvoices = invoicesResponse.data?.filter(inv => tentIds.has(inv.tent_id)) || []
      setInvoices(userInvoices)

      // Calculate enhanced stats
      const pending = userInvoices.filter(inv => inv.status === 'submitted')
      const approved = userInvoices.filter(inv => inv.status === 'approved')
      const totalRevenue = approved.reduce((sum, inv) => sum + (Number(inv.total_amount) || Number(inv.amount) || 0), 0)
      
      // Calculate growth (mock data for demo)
      const revenueGrowth = Math.random() * 30 - 10 // Random between -10% and +20%
      const invoiceGrowth = Math.random() * 40 - 5 // Random between -5% and +35%
      const completionRate = userInvoices.length > 0 
        ? (approved.length / userInvoices.length) * 100 
        : 0

      setStats({
        totalTents: formattedTents.length,
        totalInvoices: userInvoices.length,
        pendingInvoices: pending.length,
        approvedInvoices: approved.length,
        totalRevenue,
        revenueGrowth,
        invoiceGrowth,
        completionRate
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
  }, [fetchDashboardData])

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

      setShowJoinDialog(false)
      setJoinCode('')
      
      // Celebration animation
      toast({
        title: '🎉 Welcome aboard!',
        description: `You've joined ${data.tent.name}`,
      })
      
      navigate(`/tents/${data.tent.id}`)
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
      title: '📋 Copied!',
      description: 'Invite code copied to clipboard',
    })
  }, [toast])

  const filteredTents = useMemo(() => {
    let filtered = tents
    
    if (searchQuery) {
      filtered = filtered.filter(tent => 
        tent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tent.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(tent => {
        const member = tent.tent_members.find(m => m.user_id === userId)
        if (selectedFilter === 'admin') return member?.is_admin
        if (selectedFilter === 'client') return member?.tent_role === 'client'
        if (selectedFilter === 'manager') return member?.tent_role === 'manager'
        return true
      })
    }
    
    return filtered
  }, [tents, searchQuery, selectedFilter, userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-lg font-medium">Setting up your workspace...</p>
          <p className="text-sm text-gray-500 mt-2">This will just take a moment</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Top Navigation Bar */}
      <motion.nav 
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <Tent className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  VoiceOut
                </h1>
              </div>
              
              {/* Search Bar */}
              <div className="relative w-96 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tents, invoices..."
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
                  ⌘K
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Quick Actions */}
              <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                  >
                    <Bell className="h-5 w-5" />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Notifications</span>
                      {notifications.filter(n => !n.read).length > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto p-1 text-xs">
                          Mark all read
                        </Button>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    notifications.slice(0, 5).map((notification) => (
                      <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3">
                        <div className="flex items-start gap-2 w-full">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5",
                            !notification.read && "bg-blue-500"
                          )} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm text-gray-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      No notifications yet
                    </div>
                  )}
                  {notifications.length > 5 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-center text-sm text-blue-600">
                        View all notifications
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  document.documentElement.classList.toggle('dark')
                  toast({
                    title: document.documentElement.classList.contains('dark') ? '🌙 Dark mode enabled' : '☀️ Light mode enabled',
                    description: 'Your preference has been saved',
                  })
                }}
              >
                <Sun className="h-5 w-5 dark:hidden" />
                <Moon className="h-5 w-5 hidden dark:block" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/avatar.png" />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {userEmail?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userEmail}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userRole === 'manager' ? 'Manager' : 'Creator'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                {greeting.emoji} {greeting.text}, Creator!
              </h2>
              <p className="text-gray-600 mt-2 flex items-center gap-2">
                <motivationalMessage.icon className="h-4 w-4 text-yellow-500" />
                {motivationalMessage.text}
              </p>
            </div>
            
            {/* Quick Stats for Today */}
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-0">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.pendingInvoices}</p>
                  <p className="text-xs text-gray-600">Pending Review</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.approvedInvoices}</p>
                  <p className="text-xs text-gray-600">Approved</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{stats.completionRate.toFixed(0)}%</p>
                  <p className="text-xs text-gray-600">Completion</p>
                </div>
              </div>
            </Card>
          </div>
        </motion.div>

        {/* Quick Actions Bar */}
        <motion.div 
          className="flex items-center gap-3 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur">
            <CreateTentDialog onTentCreated={fetchDashboardData} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJoinDialog(true)}
              className="flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Join Tent</span>
            </Button>
            {userRole === 'manager' && (
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            )}
          </Card>
          
          {userRole === 'manager' && stats.pendingInvoices > 0 && (
            <Card className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-yellow-200">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                {stats.pendingInvoices} invoices awaiting review
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-yellow-700 hover:text-yellow-900"
              >
                Review Now
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Card>
          )}
        </motion.div>

        {/* Stats Overview */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <Badge variant={stats.revenueGrowth > 0 ? "default" : "destructive"} className="text-xs">
                {stats.revenueGrowth > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {Math.abs(stats.revenueGrowth).toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Revenue</p>
            <Progress value={75} className="mt-2 h-1" />
          </Card>

          <Card className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <Badge variant="default" className="text-xs">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                {stats.invoiceGrowth.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold">{stats.totalInvoices}</p>
            <p className="text-xs text-gray-500">Total Invoices</p>
            <Progress value={stats.completionRate} className="mt-2 h-1" />
          </Card>

          <Card className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.approvedInvoices}</p>
            <p className="text-xs text-gray-500">Approved</p>
            <Progress value={(stats.approvedInvoices / Math.max(stats.totalInvoices, 1)) * 100} className="mt-2 h-1" />
          </Card>

          <Card className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <Badge variant="outline" className="text-xs">Pending</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.pendingInvoices}</p>
            <p className="text-xs text-gray-500">Awaiting Review</p>
            <Progress value={(stats.pendingInvoices / Math.max(stats.totalInvoices, 1)) * 100} className="mt-2 h-1" />
          </Card>
        </motion.div>

        {/* Tents Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Tent className="h-5 w-5 text-blue-600" />
              Your Tents
            </h3>
            
            <div className="flex items-center gap-2">
              {/* Filters */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSelectedFilter('all')}>
                    All Tents
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedFilter('admin')}>
                    Admin Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedFilter('client')}>
                    As Client
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedFilter('manager')}>
                    As Manager
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {filteredTents.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-12"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                  <Tent className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No tents yet</h3>
                <p className="text-gray-500 mb-6">Create your first tent or join an existing one</p>
                <div className="flex gap-3 justify-center">
                  <CreateTentDialog onTentCreated={fetchDashboardData} />
                  <Button onClick={() => setShowJoinDialog(true)} variant="outline">
                    <LogIn className="mr-2 h-4 w-4" />
                    Join Tent
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                className={cn(
                  "grid gap-4",
                  viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                )}
                layout
              >
                <LayoutGroup>
                  {filteredTents.map((tent, index) => {
                    const member = tent.tent_members.find(m => m.user_id === userId)
                    const isAdmin = member?.is_admin || false
                    const role = member?.tent_role || 'member'
                    
                    return (
                      <motion.div
                        key={tent.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -4 }}
                        onMouseEnter={() => prefetch(`/tents/${tent.id}`)}
                      >
                        <Card 
                          className={cn(
                            "p-5 cursor-pointer transition-all hover:shadow-xl",
                            viewMode === 'list' && "flex items-center justify-between"
                          )}
                          onClick={() => navigate(`/tents/${tent.id}`)}
                        >
                          <div className={cn(viewMode === 'list' && "flex items-center gap-4 flex-1")}>
                            <div className={cn(
                              "flex items-center gap-3 mb-3",
                              viewMode === 'list' && "mb-0"
                            )}>
                              <div className={cn(
                                "p-2 rounded-lg",
                                isAdmin ? "bg-purple-100" : "bg-blue-100"
                              )}>
                                <Tent className={cn(
                                  "h-5 w-5",
                                  isAdmin ? "text-purple-600" : "text-blue-600"
                                )} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">{tent.name}</h4>
                                {tent.description && viewMode === 'grid' && (
                                  <p className="text-sm text-gray-500 line-clamp-1">{tent.description}</p>
                                )}
                              </div>
                            </div>
                            
                            {viewMode === 'grid' && (
                              <>
                                <div className="flex items-center gap-2 mb-3">
                                  {isAdmin && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Star className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {role}
                                  </Badge>
                                  {tent.is_locked ? (
                                    <Badge variant="destructive" className="text-xs">Locked</Badge>
                                  ) : (
                                    <Badge variant="default" className="text-xs">Open</Badge>
                                  )}
                                </div>
                                
                                {!tent.is_locked && (
                                  <div className="flex items-center justify-between pt-3 border-t">
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                      {tent.invite_code}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyInviteCode(tent.invite_code)
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          
                          {viewMode === 'list' && (
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Star className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs capitalize">
                                  {role}
                                </Badge>
                                {tent.is_locked ? (
                                  <Badge variant="destructive" className="text-xs">Locked</Badge>
                                ) : (
                                  <Badge variant="default" className="text-xs">Open</Badge>
                                )}
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    )
                  })}
                </LayoutGroup>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            Recent Activity
          </h3>
          <Card className="p-4">
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice, index) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  onMouseEnter={() => prefetch(`/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      invoice.status === 'approved' ? "bg-green-100" :
                      invoice.status === 'rejected' ? "bg-red-100" :
                      invoice.status === 'submitted' ? "bg-yellow-100" :
                      "bg-gray-100"
                    )}>
                      {invoice.status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                       invoice.status === 'rejected' ? <XCircle className="h-4 w-4 text-red-600" /> :
                       invoice.status === 'submitted' ? <Clock className="h-4 w-4 text-yellow-600" /> :
                       <FileText className="h-4 w-4 text-gray-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{invoice.invoice_number}</p>
                      <p className="text-xs text-gray-500">{invoice.client_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">${(invoice.total_amount || invoice.amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{new Date(invoice.created_at).toLocaleDateString()}</p>
                  </div>
                </motion.div>
              ))}
              
              {invoices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Create Tent Dialog */}
      <CreateTentDialog 
        open={showCreateTentDialog}
        onOpenChange={setShowCreateTentDialog}
        onTentCreated={() => {
          setShowCreateTentDialog(false)
          fetchDashboardData()
        }} 
      />

      {/* Join Tent Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join a Tent</DialogTitle>
            <DialogDescription>
              Enter the 6-character invite code to join an existing tent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="invite-code" className="text-sm font-medium">
                Invite Code
              </label>
              <Input
                id="invite-code"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-2xl font-mono tracking-wider"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowJoinDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinTent}
              disabled={joining || joinCode.length !== 6}
            >
              {joining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Tent'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button for Mobile */}
      <motion.div
        className="fixed bottom-6 right-6 md:hidden"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" className="h-14 w-14 rounded-full shadow-lg">
              <PlusCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowCreateTentDialog(true)}>
              <Tent className="mr-2 h-4 w-4" />
              Create Tent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowJoinDialog(true)}>
              <LogIn className="mr-2 h-4 w-4" />
              Join Tent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </div>
  )
}