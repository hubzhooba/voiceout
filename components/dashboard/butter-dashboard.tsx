'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { NotificationProvider } from '@/components/providers/notification-provider'
import { NotificationBell } from '@/components/notification-bell'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/currency'
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
  Settings,
  User,
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
  const { theme, toggleTheme } = useTheme()
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
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [userRole, setUserRole] = useState<'creator' | 'manager'>('creator')
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

  const getWorkflowStepLabel = (step: number) => {
    const steps = [
      { num: 1, label: 'Project Created' },
      { num: 2, label: 'Pending Approval' },
      { num: 3, label: 'Invoice Requested' },
      { num: 4, label: 'Awaiting Invoice' },
      { num: 5, label: 'Ready for Acceptance' }
    ]
    
    const currentStep = steps.find(s => s.num === step)
    if (!currentStep) return 'Unknown'
    
    return currentStep.label
  }

  const getStepStatusColor = (step: number, status: string) => {
    if (status === 'completed') return 'text-green-600'
    if (status === 'in_progress') {
      if (step === 2 || step === 4) return 'text-amber-600' // Waiting on manager
      return 'text-blue-600' // Active work
    }
    return 'text-gray-400'
  }

  const fetchDashboardData = useCallback(async () => {
    try {
      const [tentsResponse, projectsResponse] = await Promise.all([
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
          .from('projects')
          .select('*, tents(name), workflow_step, step1_status, step2_status, step3_status, step4_status, step5_status')
          .order('created_at', { ascending: false })
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
      // Only set manager role if user actually has tents with manager role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasManagerRole = tentsResponse.data && tentsResponse.data.length > 0 && tentsResponse.data.some((item: any) => item.tent_role === 'manager')
      setUserRole(hasManagerRole ? 'manager' : 'creator')

      const tentIds = new Set(formattedTents.map(t => t.id))
      const userProjects = projectsResponse.data?.filter(proj => tentIds.has(proj.tent_id)) || []
      setInvoices(userProjects)

      // Calculate enhanced stats
      const pending = userProjects.filter(proj => proj.status === 'in_progress' || proj.status === 'review')
      const completed = userProjects.filter(proj => proj.status === 'completed')
      const totalRevenue = userProjects.reduce((sum, proj) => sum + (Number(proj.total_amount) || 0), 0)
      
      // Calculate growth (mock data for demo)
      const revenueGrowth = Math.random() * 30 - 10 // Random between -10% and +20%
      const invoiceGrowth = Math.random() * 40 - 5 // Random between -5% and +35%
      const completionRate = userProjects.length > 0 
        ? (completed.length / userProjects.length) * 100 
        : 0

      setStats({
        totalTents: formattedTents.length,
        totalInvoices: userProjects.length,
        pendingInvoices: pending.length,
        approvedInvoices: completed.length,
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-gray-900 dark:to-blue-950">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 dark:text-primary-400 mx-auto mb-4" />
          <p className="text-lg font-medium dark:text-gray-100">Setting up your workspace...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This will just take a moment</p>
        </motion.div>
      </div>
    )
  }

  return (
    <NotificationProvider userId={userId}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-gray-900 dark:to-blue-950 transition-colors duration-300">
      {/* Top Navigation Bar */}
      <motion.nav 
        className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-colors duration-300"
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
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  CreatorTents
                </h1>
              </div>
              
              {/* Search Bar */}
              <div className="relative w-96 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tents, invoices..."
                  className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-750 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                  ⌘K
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <NotificationBell />

              <Button
                variant="ghost"
                size="icon"
                className="hover-icon"
                onClick={() => {
                  toggleTheme()
                  toast({
                    title: theme === 'light' ? '🌙 Dark mode enabled' : '☀️ Light mode enabled',
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
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full hover-button-subtle">
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
                  <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={async () => {
                      await supabase.auth.signOut()
                      window.location.href = '/auth/login'
                    }}
                  >
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
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                {greeting.emoji} {greeting.text}, Creator!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                <motivationalMessage.icon className="h-4 w-4 text-yellow-500" />
                {motivationalMessage.text}
              </p>
            </div>
            
            {/* Quick Stats for Today */}
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-0 hover-card-subtle">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.pendingInvoices}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Active Projects</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approvedInvoices}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Approved</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.completionRate.toFixed(0)}%</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Completion</p>
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
          <Card className="flex items-center gap-2 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur hover-card-subtle">
            <CreateTentDialog onTentCreated={fetchDashboardData} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJoinDialog(true)}
              className="flex items-center gap-2 hover-button-subtle"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Join Tent</span>
            </Button>
          </Card>
          
          {userRole === 'manager' && stats.pendingInvoices > 0 && (
            <Card className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover-glow">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {stats.pendingInvoices} active projects
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 hover-button-subtle"
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
          <Card className="p-4 hover-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <Badge variant={stats.revenueGrowth > 0 ? "default" : "destructive"} className="text-xs">
                {stats.revenueGrowth > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {Math.abs(stats.revenueGrowth).toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold dark:text-gray-100">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
            <Progress value={75} className="mt-2 h-1" />
          </Card>

          <Card className="p-4 hover-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <Badge variant="default" className="text-xs">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                {stats.invoiceGrowth.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold dark:text-gray-100">{stats.totalInvoices}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Projects</p>
            <Progress value={stats.completionRate} className="mt-2 h-1" />
          </Card>

          <Card className="p-4 hover-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            <p className="text-2xl font-bold dark:text-gray-100">{stats.approvedInvoices}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Approved</p>
            <Progress value={(stats.approvedInvoices / Math.max(stats.totalInvoices, 1)) * 100} className="mt-2 h-1" />
          </Card>

          <Card className="p-4 hover-card">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <Badge variant="outline" className="text-xs">Pending</Badge>
            </div>
            <p className="text-2xl font-bold dark:text-gray-100">{stats.pendingInvoices}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Projects</p>
            <Progress value={(stats.pendingInvoices / Math.max(stats.totalInvoices, 1)) * 100} className="mt-2 h-1" />
          </Card>
        </motion.div>

        {/* Tents Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold dark:text-gray-100 flex items-center gap-2">
              <Tent className="h-5 w-5 text-blue-600" />
              Your Tents
            </h3>
            
            <div className="flex items-center gap-2">
              {/* Filters */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hover-button-subtle">
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
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
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
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                  <Tent className="h-10 w-10 text-gray-400 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No tents yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Join an existing tent to get started</p>
                <div className="flex gap-3 justify-center">
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
                            "p-5 cursor-pointer hover-card dark:bg-gray-800/50",
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
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{tent.name}</h4>
                                {tent.description && viewMode === 'grid' && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{tent.description}</p>
                                )}
                              </div>
                            </div>
                            
                            {viewMode === 'grid' && (
                              <>
                                <div className="flex items-center gap-2 mb-3">
                                  {isAdmin && (
                                    <Badge variant="secondary" className="text-xs hover-badge">
                                      <Star className="h-3 w-3 mr-1" />
                                      Admin
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs capitalize hover-badge">
                                    {role}
                                  </Badge>
                                  {tent.is_locked ? (
                                    <Badge variant="destructive" className="text-xs hover-badge">Locked</Badge>
                                  ) : (
                                    <Badge variant="default" className="text-xs hover-badge">Open</Badge>
                                  )}
                                </div>
                                
                                {!tent.is_locked && (
                                  <div className="flex items-center justify-between pt-3 border-t">
                                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono dark:text-gray-300">
                                      {tent.invite_code}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="hover-icon"
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
                              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-600" />
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
          <h3 className="text-xl font-semibold dark:text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            Recent Activity
          </h3>
          <Card className="p-4 hover-card-subtle">
            <div className="space-y-3">
              {invoices.slice(0, 5).map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 hover-list-item rounded-lg cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  onMouseEnter={() => prefetch(`/projects/${project.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      project.status === 'completed' ? "bg-green-100" :
                      project.status === 'cancelled' ? "bg-red-100" :
                      project.status === 'in_progress' ? "bg-blue-100" :
                      project.status === 'review' ? "bg-yellow-100" :
                      "bg-gray-100"
                    )}>
                      {project.status === 'completed' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                       project.status === 'cancelled' ? <XCircle className="h-4 w-4 text-red-600" /> :
                       project.status === 'in_progress' ? <Clock className="h-4 w-4 text-blue-600" /> :
                       project.status === 'review' ? <FileText className="h-4 w-4 text-yellow-600" /> :
                       <FileText className="h-4 w-4 text-gray-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm dark:text-gray-200">{project.project_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{project.client_name}</p>
                      <p className={cn("text-xs mt-1 font-medium", 
                        getStepStatusColor(project.workflow_step, project[`step${project.workflow_step}_status`])
                      )}>
                        Step {project.workflow_step}: {getWorkflowStepLabel(project.workflow_step)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm dark:text-gray-200">{formatCurrency(project.total_amount || 0)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(project.updated_at || project.created_at).toLocaleDateString()}</p>
                  </div>
                </motion.div>
              ))}
              
              {invoices.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

      </div>

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
            <DropdownMenuItem onClick={() => setShowJoinDialog(true)}>
              <LogIn className="mr-2 h-4 w-4" />
              Join Tent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </div>
    </NotificationProvider>
  )
}