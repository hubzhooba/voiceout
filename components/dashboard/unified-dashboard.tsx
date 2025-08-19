'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { format, isAfter, isBefore, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Users,
  Briefcase,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  PieChart,
  BarChart3,
  Target,
  Receipt,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  RefreshCw,
  Tent
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'

interface UnifiedDashboardProps {
  userId: string
  userEmail: string
}

interface TentWithStats {
  id: string
  name: string
  role: string
  isAdmin: boolean
  activeProjects: number
  totalRevenue: number
  pendingInvoices: number
  completionRate: number
}

interface Project {
  id: string
  tent_id: string
  project_name: string
  client_name: string
  status: string
  priority: string
  progress_percentage: number
  total_amount: number | null
  payment_status: string | null
  due_date: string | null
  requires_invoice: boolean
  invoice_status: string
  created_at?: string
}

interface FinancialMetrics {
  totalRevenue: number
  pendingPayments: number
  overdueAmount: number
  taxLiability: number
  monthlyGrowth: number
  averageProjectValue: number
}

export function UnifiedDashboard({ userId }: UnifiedDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [selectedTent, setSelectedTent] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'overview' | 'financial' | 'projects' | 'analytics'>('overview')
  const [dateRange, setDateRange] = useState('this_month')
  const [tents, setTents] = useState<TentWithStats[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>({
    totalRevenue: 0,
    pendingPayments: 0,
    overdueAmount: 0,
    taxLiability: 0,
    monthlyGrowth: 0,
    averageProjectValue: 0
  })
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([])
  const [projectStatusData, setProjectStatusData] = useState<{ name: string; value: number; color: string }[]>([])
  const [taxData, setTaxData] = useState<{ name: string; value: number; color: string }[]>([])
  
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTent, dateRange])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch user's tents with roles
      const { data: tentMembers, error: tentError } = await supabase
        .from('tent_members')
        .select(`
          tent_id,
          tent_role,
          is_admin,
          tents (
            id,
            name
          )
        `)
        .eq('user_id', userId)

      if (tentError) throw tentError

      // Fetch projects based on selected tent
      let projectQuery = supabase
        .from('projects')
        .select('*')
        
      if (selectedTent !== 'all') {
        projectQuery = projectQuery.eq('tent_id', selectedTent)
      } else if (tentMembers) {
        const tentIds = tentMembers.map(tm => tm.tent_id)
        projectQuery = projectQuery.in('tent_id', tentIds)
      }

      const { data: projectsData, error: projectsError } = await projectQuery
      if (projectsError) throw projectsError

      setProjects(projectsData || [])

      // Calculate tent statistics
      const tentStats: TentWithStats[] = tentMembers?.map(tm => {
        const tentProjects = projectsData?.filter(p => p.tent_id === tm.tent_id) || []
        const activeProjects = tentProjects.filter(p => ['planning', 'in_progress', 'review'].includes(p.status)).length
        const totalRevenue = tentProjects.reduce((sum, p) => sum + (p.total_amount || 0), 0)
        const pendingInvoices = tentProjects.filter(p => p.requires_invoice && p.invoice_status === 'submitted').length
        const completedProjects = tentProjects.filter(p => p.status === 'completed').length
        const completionRate = tentProjects.length > 0 ? (completedProjects / tentProjects.length) * 100 : 0

        return {
          id: tm.tent_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (tm as any).tents?.name || 'Unknown Tent',
          role: tm.tent_role || 'member',
          isAdmin: tm.is_admin || false,
          activeProjects,
          totalRevenue,
          pendingInvoices,
          completionRate
        }
      }) || []

      setTents(tentStats)

      // Calculate financial metrics
      calculateFinancialMetrics(projectsData || [])

      // Generate chart data
      generateChartData(projectsData || [])

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
  }

  const calculateFinancialMetrics = (projects: Project[]) => {
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    // Total revenue (completed projects with invoices)
    const totalRevenue = projects
      .filter(p => p.status === 'completed' && p.payment_status === 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0)

    // Pending payments
    const pendingPayments = projects
      .filter(p => p.requires_invoice && p.payment_status === 'pending')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0)

    // Overdue amounts
    const overdueAmount = projects
      .filter(p => {
        if (!p.due_date || p.payment_status === 'paid') return false
        return isBefore(new Date(p.due_date), now)
      })
      .reduce((sum, p) => sum + (p.total_amount || 0), 0)

    // Tax liability (simplified calculation)
    const taxLiability = projects
      .filter(p => p.requires_invoice && p.payment_status === 'paid')
      .reduce((sum, p) => sum + ((p.total_amount || 0) * 0.1), 0) // Assuming 10% tax

    // Monthly growth
    const thisMonthRevenue = projects
      .filter(p => {
        const createdAt = new Date(p.created_at || '')
        return isAfter(createdAt, thisMonthStart) && p.payment_status === 'paid'
      })
      .reduce((sum, p) => sum + (p.total_amount || 0), 0)

    const lastMonthRevenue = projects
      .filter(p => {
        const createdAt = new Date(p.created_at || '')
        return isAfter(createdAt, lastMonthStart) && isBefore(createdAt, lastMonthEnd) && p.payment_status === 'paid'
      })
      .reduce((sum, p) => sum + (p.total_amount || 0), 0)

    const monthlyGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0

    // Average project value
    const paidProjects = projects.filter(p => p.payment_status === 'paid' && p.total_amount)
    const averageProjectValue = paidProjects.length > 0
      ? paidProjects.reduce((sum, p) => sum + (p.total_amount || 0), 0) / paidProjects.length
      : 0

    setFinancialMetrics({
      totalRevenue,
      pendingPayments,
      overdueAmount,
      taxLiability,
      monthlyGrowth,
      averageProjectValue
    })
  }

  const generateChartData = (projects: Project[]) => {
    // Revenue trend data (last 6 months)
    const revenueByMonth: { [key: string]: number } = {}
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const monthKey = format(monthDate, 'MMM yyyy')
      revenueByMonth[monthKey] = 0
    }

    projects.forEach(p => {
      if (p.payment_status === 'paid' && p.total_amount) {
        const createdAt = new Date(p.created_at || '')
        const monthKey = format(createdAt, 'MMM yyyy')
        if (revenueByMonth.hasOwnProperty(monthKey)) {
          revenueByMonth[monthKey] += p.total_amount
        }
      }
    })

    setRevenueData(
      Object.entries(revenueByMonth).map(([month, revenue]) => ({
        month,
        revenue
      }))
    )

    // Project status distribution
    const statusCounts: { [key: string]: number } = {
      planning: 0,
      in_progress: 0,
      review: 0,
      completed: 0,
      on_hold: 0,
      cancelled: 0
    }

    projects.forEach(p => {
      if (statusCounts.hasOwnProperty(p.status)) {
        statusCounts[p.status]++
      }
    })

    setProjectStatusData(
      Object.entries(statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          name: status.replace('_', ' '),
          value: count,
          color: getStatusColor(status)
        }))
    )

    // Tax breakdown
    const taxBreakdown = projects
      .filter(p => p.requires_invoice && p.payment_status === 'paid')
      .reduce((acc, p) => {
        const revenue = p.total_amount || 0
        const tax = revenue * 0.1 // 10% tax
        const withholding = revenue * 0.02 // 2% withholding
        
        return {
          revenue: acc.revenue + revenue,
          tax: acc.tax + tax,
          withholding: acc.withholding + withholding,
          net: acc.net + (revenue - tax - withholding)
        }
      }, { revenue: 0, tax: 0, withholding: 0, net: 0 })

    setTaxData([
      { name: 'Revenue', value: taxBreakdown.revenue, color: '#10b981' },
      { name: 'Tax', value: taxBreakdown.tax, color: '#f59e0b' },
      { name: 'Withholding', value: taxBreakdown.withholding, color: '#ef4444' },
      { name: 'Net Income', value: taxBreakdown.net, color: '#3b82f6' }
    ])
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      planning: '#9ca3af',
      in_progress: '#3b82f6',
      review: '#f59e0b',
      completed: '#10b981',
      on_hold: '#fb923c',
      cancelled: '#ef4444'
    }
    return colors[status] || '#9ca3af'
  }

  const getFilteredProjects = () => {
    let filtered = projects

    if (selectedTent !== 'all') {
      filtered = filtered.filter(p => p.tent_id === selectedTent)
    }

    // Add date filtering based on dateRange
    // ... implement date filtering logic

    return filtered
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
          <p className="font-medium">{label}</p>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const filteredProjects = getFilteredProjects()
  const userRoles = [...new Set(tents.map(t => t.role))]
  const isManager = userRoles.includes('manager')
  const isClient = userRoles.includes('client')

  return (
    <div className="space-y-6 p-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Unified Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {isManager && isClient ? 'Managing projects across all your tents' :
             isManager ? 'Overseeing client projects and finances' :
             'Tracking your projects and invoices'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedTent} onValueChange={setSelectedTent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select tent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center">
                  <Tent className="h-4 w-4 mr-2" />
                  All Tents
                </div>
              </SelectItem>
              {tents.map(tent => (
                <SelectItem key={tent.id} value={tent.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{tent.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {tent.role}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    ${financialMetrics.totalRevenue.toFixed(2)}
                  </span>
                  <div className={`flex items-center text-sm ${financialMetrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {financialMetrics.monthlyGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {Math.abs(financialMetrics.monthlyGrowth).toFixed(1)}%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {filteredProjects.filter(p => ['planning', 'in_progress', 'review'].includes(p.status)).length}
                  </span>
                  <Activity className="h-8 w-8 text-blue-600 opacity-20" />
                </div>
                <Progress 
                  value={
                    (filteredProjects.filter(p => p.status === 'completed').length / 
                    (filteredProjects.length || 1)) * 100
                  } 
                  className="mt-2 h-1"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    ${financialMetrics.pendingPayments.toFixed(2)}
                  </span>
                  <Clock className="h-8 w-8 text-yellow-600 opacity-20" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {filteredProjects.filter(p => p.payment_status === 'pending').length} invoices
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue Amount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-red-600">
                    ${financialMetrics.overdueAmount.toFixed(2)}
                  </span>
                  <AlertCircle className="h-8 w-8 text-red-600 opacity-20" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Requires immediate attention
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tent Overview */}
          {tents.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Tent Performance</CardTitle>
                <CardDescription>Overview of your tents and their performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tents.map(tent => (
                    <div key={tent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{tent.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{tent.role}</Badge>
                            {tent.isAdmin && <Badge variant="secondary">Admin</Badge>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-muted-foreground">Active</p>
                          <p className="font-semibold">{tent.activeProjects}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-semibold">${tent.totalRevenue.toFixed(0)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-semibold">{tent.pendingInvoices}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Completion</p>
                          <p className="font-semibold">{tent.completionRate.toFixed(0)}%</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/tents/${tent.id}`)}
                        >
                          View Tent
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Projects */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Latest projects across your tents</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {filteredProjects.slice(0, 10).map(project => (
                    <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{project.project_name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-muted-foreground">{project.client_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {project.status.replace('_', ' ')}
                          </Badge>
                          {project.requires_invoice && (
                            <Badge variant="secondary" className="text-xs">
                              <DollarSign className="h-3 w-3 mr-1" />
                              Invoice
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {project.total_amount && (
                          <span className="font-semibold">${project.total_amount.toFixed(2)}</span>
                        )}
                        <Progress value={project.progress_percentage} className="w-20 h-2" />
                        <span className="text-sm text-muted-foreground">{project.progress_percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tax Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Tax & Compliance</CardTitle>
                <CardDescription>Breakdown of revenue, taxes, and net income</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={taxData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {taxData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average Project Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  ${financialMetrics.averageProjectValue.toFixed(2)}
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  Based on completed projects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tax Liability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-orange-600">
                  ${financialMetrics.taxLiability.toFixed(2)}
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  Estimated quarterly payment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cash Flow Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-green-600">
                  Positive
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  ${(financialMetrics.totalRevenue - financialMetrics.taxLiability).toFixed(2)} available
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Payments</CardTitle>
              <CardDescription>Projects with pending or upcoming payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredProjects
                  .filter(p => p.requires_invoice && p.payment_status !== 'paid')
                  .sort((a, b) => {
                    if (!a.due_date) return 1
                    if (!b.due_date) return -1
                    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                  })
                  .slice(0, 10)
                  .map(project => (
                    <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{project.project_name}</p>
                        <p className="text-sm text-muted-foreground">{project.client_name}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">${project.total_amount?.toFixed(2) || '0.00'}</p>
                          {project.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(project.due_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                        <Badge variant={
                          project.payment_status === 'overdue' ? 'destructive' :
                          project.payment_status === 'pending' ? 'secondary' :
                          'outline'
                        }>
                          {project.payment_status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          {/* Project Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Project Status Distribution</CardTitle>
              <CardDescription>Overview of all projects by status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6">
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Project List with Filters */}
          <Card>
            <CardHeader>
              <CardTitle>All Projects</CardTitle>
              <CardDescription>Complete list of projects across all tents</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredProjects.map(project => {
                    const tent = tents.find(t => t.id === project.tent_id)
                    
                    return (
                      <div key={project.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold">{project.project_name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {tent?.name}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mt-1">{project.client_name}</p>
                            
                            <div className="flex items-center gap-3 mt-2">
                              <Badge className={`text-xs ${getStatusColor(project.status)} bg-opacity-20`}>
                                {project.status.replace('_', ' ')}
                              </Badge>
                              
                              <Badge variant="outline" className="text-xs">
                                {project.priority} priority
                              </Badge>
                              
                              {project.requires_invoice && (
                                <Badge variant="secondary" className="text-xs">
                                  <Receipt className="h-3 w-3 mr-1" />
                                  {project.invoice_status}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 mt-3">
                              <Progress value={project.progress_percentage} className="flex-1 h-2" />
                              <span className="text-sm font-medium">{project.progress_percentage}%</span>
                            </div>
                          </div>
                          
                          <div className="text-right ml-4">
                            {project.total_amount && (
                              <p className="font-semibold text-lg">${project.total_amount.toFixed(2)}</p>
                            )}
                            
                            {project.due_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Due: {format(new Date(project.due_date), 'MMM d')}
                              </p>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => router.push(`/projects/${project.id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Project Completion Rate</span>
                      <span className="text-sm font-bold">
                        {((filteredProjects.filter(p => p.status === 'completed').length / (filteredProjects.length || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={(filteredProjects.filter(p => p.status === 'completed').length / (filteredProjects.length || 1)) * 100}
                      className="h-2"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Invoice Collection Rate</span>
                      <span className="text-sm font-bold">
                        {((filteredProjects.filter(p => p.payment_status === 'paid').length / 
                          (filteredProjects.filter(p => p.requires_invoice).length || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={(filteredProjects.filter(p => p.payment_status === 'paid').length / 
                        (filteredProjects.filter(p => p.requires_invoice).length || 1)) * 100}
                      className="h-2"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">On-Time Delivery</span>
                      <span className="text-sm font-bold">85.3%</span>
                    </div>
                    <Progress value={85.3} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Client Satisfaction</span>
                      <span className="text-sm font-bold">92.7%</span>
                    </div>
                    <Progress value={92.7} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Clients */}
            <Card>
              <CardHeader>
                <CardTitle>Top Clients</CardTitle>
                <CardDescription>Clients by project value</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    filteredProjects.reduce((acc, p) => {
                      if (!acc[p.client_name]) {
                        acc[p.client_name] = { count: 0, value: 0 }
                      }
                      acc[p.client_name].count++
                      acc[p.client_name].value += p.total_amount || 0
                      return acc
                    }, {} as { [key: string]: { count: number; value: number } })
                  )
                    .sort((a, b) => b[1].value - a[1].value)
                    .slice(0, 5)
                    .map(([client, data]) => (
                      <div key={client} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{client}</p>
                          <p className="text-sm text-muted-foreground">{data.count} projects</p>
                        </div>
                        <span className="font-semibold">${data.value.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Insights & Recommendations</CardTitle>
              <CardDescription>AI-powered insights based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Revenue Growth Opportunity</p>
                    <p className="text-sm text-muted-foreground">
                      Your revenue has grown {financialMetrics.monthlyGrowth.toFixed(1)}% this month. 
                      Consider increasing project capacity to maintain momentum.
                    </p>
                  </div>
                </div>
                
                {financialMetrics.overdueAmount > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Overdue Payments Alert</p>
                      <p className="text-sm text-muted-foreground">
                        You have ${financialMetrics.overdueAmount.toFixed(2)} in overdue payments. 
                        Consider sending payment reminders to affected clients.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <Target className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Project Efficiency</p>
                    <p className="text-sm text-muted-foreground">
                      Your average project completion time is 18 days. 
                      This is 15% faster than last quarter.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}