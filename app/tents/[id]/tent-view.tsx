'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectListEnhanced } from '@/components/project-list-enhanced'
import { ProjectFormSimple } from '@/components/project-form-simple'
import { TentSettings } from './tent-settings'
import { TentMembers } from './tent-members'
import { InquiryReview } from '@/components/email/inquiry-review'
import { EmailSettings } from '@/components/email/email-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Users, 
  Settings,
  Shield,
  Briefcase,
  Star,
  ChevronRight,
  Inbox,
  SendHorizontal,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TentMember {
  user_id: string
  tent_role: string | null
  is_admin: boolean
  joined_at: string
  profiles?: {
    id: string
    full_name: string | null
    email: string
  }
}

interface Tent {
  id: string
  name: string
  description: string | null
  business_address: string | null
  business_tin: string | null
  default_withholding_tax: number
  invoice_prefix: string | null
  invoice_notes: string | null
  invite_code: string
  is_locked: boolean
  creator_role: string | null
  tent_members: TentMember[]
}

interface TentViewProps {
  tent: Tent
  currentUserId: string
}

export function TentView({ tent, currentUserId }: TentViewProps) {
  const [activeTab, setActiveTab] = useState('projects')
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [settingsSubTab, setSettingsSubTab] = useState('email') // Default to email for all users
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    completedProjects: 0,
    activeProjects: 0,
    monthlyGrowth: 0,
    averageProjectValue: 0,
    totalProjects: 0,
    successRate: 0
  })
  const [monthlyData, setMonthlyData] = useState<{ month: string; revenue: number }[]>([])
  const router = useRouter()
  const supabase = createClient()
  
  const fetchAnalytics = useCallback(async () => {
    try {
      const { data: projects } = await supabase
        .from('projects')
        .select('total_amount, status, created_at')
        .eq('tent_id', tent.id)
      
      if (projects) {
        const totalRevenue = projects.reduce((sum, p) => sum + (p.total_amount || 0), 0)
        const pendingAmount = projects
          .filter(p => p.status === 'in_progress' || p.status === 'pending')
          .reduce((sum, p) => sum + (p.total_amount || 0), 0)
        const completedProjects = projects.filter(p => p.status === 'completed').length
        const activeProjects = projects.filter(p => p.status === 'in_progress').length
        const totalProjects = projects.length
        const averageProjectValue = totalProjects > 0 ? totalRevenue / totalProjects : 0
        const successRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0
        
        // Calculate monthly data for the last 6 months
        const now = new Date()
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const monthlyRevenue: { [key: string]: number } = {}
        
        // Initialize months
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          monthlyRevenue[monthKey] = 0
        }
        
        // Aggregate revenue by month
        projects.forEach(project => {
          const projectDate = new Date(project.created_at)
          if (projectDate >= sixMonthsAgo) {
            const monthKey = projectDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            if (monthlyRevenue[monthKey] !== undefined) {
              monthlyRevenue[monthKey] += project.total_amount || 0
            }
          }
        })
        
        // Convert to array for chart
        const chartData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
          month,
          revenue
        }))
        
        // Calculate month-over-month growth
        const lastMonth = chartData[chartData.length - 1]?.revenue || 0
        const previousMonth = chartData[chartData.length - 2]?.revenue || 0
        const monthlyGrowth = previousMonth > 0 ? ((lastMonth - previousMonth) / previousMonth) * 100 : 0
        
        setMonthlyData(chartData)
        setAnalytics({
          totalRevenue,
          pendingAmount,
          completedProjects,
          activeProjects,
          monthlyGrowth,
          averageProjectValue,
          totalProjects,
          successRate
        })
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    }
  }, [tent.id, supabase])

  useEffect(() => {
    // Set user role and admin status
    const currentMember = tent.tent_members?.find((m: TentMember) => m.user_id === currentUserId)
    
    if (currentMember) {
      setUserRole(currentMember.tent_role || '')
      setIsAdmin(currentMember.is_admin || false)
    }
    
    // Check if we should switch to a specific tab
    if (typeof window !== 'undefined') {
      const desiredTab = sessionStorage.getItem('tentActiveTab')
      if (desiredTab) {
        setActiveTab(desiredTab)
        sessionStorage.removeItem('tentActiveTab')
      }
    }
    
    // Fetch analytics data
    fetchAnalytics()
  }, [tent.tent_members, currentUserId, fetchAnalytics])

  const handleProjectCreated = () => {
    setShowProjectForm(false)
    router.refresh()
  }

  // Determine which tabs to show based on role
  const isClient = userRole === 'client'
  const isManager = userRole === 'manager'
  const isOwner = isAdmin

  const getRoleBadge = () => {
    if (isOwner) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
          <Shield className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      )
    }
    if (isManager) {
      return (
        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">
          <Briefcase className="h-3 w-3 mr-1" />
          Manager
        </Badge>
      )
    }
    return (
      <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
        <Star className="h-3 w-3 mr-1" />
        Client
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto p-4 xl:px-8 2xl:max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="mb-4 hover:bg-white/50 dark:hover:bg-gray-800/50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
            <CardHeader className="pb-4 px-6 lg:px-8">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                      {tent.name}
                    </h1>
                    {getRoleBadge()}
                  </div>
                  {tent.description && (
                    <p className="text-muted-foreground text-lg">{tent.description}</p>
                  )}
                </div>

                {isClient && (
                  <Button 
                    onClick={() => setShowProjectForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Analytics Section */}
        <div className="space-y-6 mb-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(analytics.totalRevenue)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {analytics.monthlyGrowth > 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}% this month
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Pending Amount</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                      {formatCurrency(analytics.pendingAmount)}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      In {analytics.activeProjects} active projects
                    </p>
                  </div>
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Average Project</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(analytics.averageProjectValue)}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Per project value
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Success Rate</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {analytics.successRate.toFixed(0)}%
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {analytics.completedProjects} of {analytics.totalProjects} completed
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Revenue Chart */}
          <Card className="border-0 shadow-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Monthly Revenue Trend</h3>
                  <p className="text-sm text-muted-foreground">Revenue performance over the last 6 months</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  6 Month View
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-gray-600 dark:text-gray-400"
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur min-h-[600px]">
          <CardContent className="p-6 lg:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="grid grid-cols-2 w-auto bg-gray-100/50 dark:bg-gray-800/50">
                  <TabsTrigger 
                    value="projects"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md px-6"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Projects
                  </TabsTrigger>
                  <TabsTrigger 
                    value="inquiries" 
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md px-6"
                  >
                    <Inbox className="h-4 w-4 mr-2" />
                    Inquiries
                  </TabsTrigger>
                </TabsList>
                
                <Button
                  variant={activeTab === 'settings' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setActiveTab('settings')}
                  className="ml-auto"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {/* Projects Tab */}
              <TabsContent value="projects" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Projects</h2>
                    <p className="text-muted-foreground">
                      {isClient ? 'View and track all your projects in a spreadsheet format' : 'View and track all tent projects'}
                    </p>
                  </div>
                </div>
                <ProjectListEnhanced 
                  tentId={tent.id}
                  userRole={userRole}
                  userId={currentUserId}
                  onProjectsChange={fetchAnalytics}
                />
              </TabsContent>

              {/* Inquiries Tab */}
              <TabsContent value="inquiries" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Business Inquiries</h2>
                    <p className="text-muted-foreground">
                      {isClient ? 'View your approved opportunities' : 'Review and manage incoming business inquiries'}
                    </p>
                  </div>
                </div>
                <InquiryReview 
                  tentId={tent.id}
                  userRole={isOwner ? 'owner' : isManager ? 'manager' : 'client'}
                  userId={currentUserId}
                />
              </TabsContent>

              {/* Settings Tab (for all users with role-based access) */}
              <TabsContent value="settings" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">Settings</h2>
                  <p className="text-muted-foreground mb-6">
                    {isClient ? 'Connect your email and view team members' : 'Manage your tent configuration and team'}
                  </p>
                </div>

                {/* Settings Sub-navigation */}
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Sidebar */}
                  <div className="lg:w-64 space-y-1">
                    {isOwner && (
                      <button
                        onClick={() => setSettingsSubTab('general')}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                          settingsSubTab === 'general' 
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center">
                          <Settings className="h-4 w-4 mr-3" />
                          General Settings
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => setSettingsSubTab('email')}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                        settingsSubTab === 'email' 
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center">
                        <SendHorizontal className="h-4 w-4 mr-3" />
                        Email Integration
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => setSettingsSubTab('members')}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                        settingsSubTab === 'members' 
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-3" />
                        Team Members
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1">
                    <Card className="border-0 shadow-md">
                      <CardContent className="p-6">
                        {settingsSubTab === 'general' && isOwner && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold mb-1">General Settings</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Configure your tent&apos;s business information and preferences
                              </p>
                            </div>
                            <TentSettings tent={tent} />
                          </div>
                        )}
                        
                        {settingsSubTab === 'email' && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold mb-1">Email Integration</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                {isClient 
                                  ? 'Connect your email account to automatically capture your business inquiries'
                                  : 'Connect and manage email accounts to automatically capture business inquiries'}
                              </p>
                            </div>
                            <EmailSettings 
                              tentId={tent.id}
                              userRole={isOwner ? 'owner' : isManager ? 'manager' : 'client'}
                            />
                          </div>
                        )}
                        
                        {settingsSubTab === 'members' && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold mb-1">Team Members</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                {isClient 
                                  ? 'View your team members and their roles'
                                  : 'Manage your team members and their permissions'}
                              </p>
                            </div>
                            <TentMembers 
                              tent={tent}
                              currentUserId={currentUserId}
                              isAdmin={isOwner}
                            />
                          </div>
                        )}
                        
                        {/* Show message for clients when on general settings */}
                        {settingsSubTab === 'general' && isClient && (
                          <div className="text-center py-8">
                            <Settings className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                              Access Restricted
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              General settings are only available to tent owners.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Project Creation Dialog */}
        <Dialog open={showProjectForm} onOpenChange={setShowProjectForm}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <ProjectFormSimple
              tentId={tent.id}
              tentSettings={{
                business_address: tent.business_address,
                business_tin: tent.business_tin,
                default_withholding_tax: tent.default_withholding_tax,
                invoice_prefix: tent.invoice_prefix,
                invoice_notes: tent.invoice_notes
              }}
              onSuccess={handleProjectCreated}
              onCancel={() => setShowProjectForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}