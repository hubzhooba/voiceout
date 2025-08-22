'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { 
  DollarSign, 
  Calendar, 
  User, 
  CheckCircle, 
  Clock,
  MoreVertical,
  Eye,
  Edit,
  Briefcase,
  FileText,
  Upload,
  Activity
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  project_number: string
  project_name: string
  client_name: string
  project_type: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: string
  priority: string
  requires_invoice: boolean
  invoice_status: string
  budget_amount: number | null
  total_amount: number | null
  payment_status: string | null
  payment_due_date: string | null
  total_tasks: number
  completed_tasks: number
  progress_percentage: number
  workflow_step: number
  step1_status: string
  step2_status: string
  step3_status: string
  step4_status: string
  step5_status: string
  invoice_file_url: string | null
  created_by: string
  created_at: string
  updated_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface ProjectListEnhancedProps {
  tentId: string
  userRole: string
  userId: string
}

export function ProjectListEnhanced({ tentId, userRole, userId }: ProjectListEnhancedProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    totalValue: 0,
    pendingApproval: 0,
    awaitingInvoice: 0
  })
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  const isManager = userRole === 'manager'

  useEffect(() => {
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          workflow_step,
          step1_status,
          step2_status,
          step3_status,
          step4_status,
          step5_status,
          invoice_file_url,
          profiles!projects_created_by_fkey (
            full_name,
            email
          )
        `)
        .eq('tent_id', tentId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setProjects(data || [])
      
      // Calculate stats
      const active = data?.filter(p => p.status === 'in_progress').length || 0
      const completed = data?.filter(p => p.status === 'completed').length || 0
      const totalValue = data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0
      const pendingApproval = data?.filter(p => p.workflow_step === 2 && p.step2_status === 'in_progress').length || 0
      const awaitingInvoice = data?.filter(p => p.workflow_step === 4 && p.step4_status === 'in_progress').length || 0

      setStats({
        total: data?.length || 0,
        active,
        completed,
        totalValue,
        pendingApproval,
        awaitingInvoice
      })
    } catch (error) {
      console.error('Error fetching projects:', error)
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getWorkflowStepBadge = (project: Project) => {
    const steps = [
      { num: 1, label: 'Created', status: project.step1_status },
      { num: 2, label: 'Approval', status: project.step2_status },
      { num: 3, label: 'Invoice Request', status: project.step3_status },
      { num: 4, label: 'Invoice Upload', status: project.step4_status },
      { num: 5, label: 'Completed', status: project.step5_status }
    ]

    const currentStep = steps[project.workflow_step - 1]
    
    if (!currentStep) return null

    const getStepColor = (status: string) => {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
        case 'in_progress':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      }
    }

    return (
      <Badge className={getStepColor(currentStep.status)}>
        Step {currentStep.num}: {currentStep.label}
      </Badge>
    )
  }

  const getActionForProject = (project: Project) => {
    const isCreator = project.created_by === userId
    
    switch (project.workflow_step) {
      case 1:
        return isCreator ? 'Submit for Approval' : null
      case 2:
        return isManager ? 'Review & Approve' : null
      case 3:
        return isCreator ? 'Request Invoice' : null
      case 4:
        return isManager ? 'Upload Invoice' : null
      case 5:
        return isCreator && !project.step5_status ? 'Accept & Complete' : null
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'on_hold':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }


  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true
    if (filter === 'active') return project.status === 'in_progress'
    if (filter === 'completed') return project.status === 'completed'
    if (filter === 'pending_approval') return project.workflow_step === 2 && project.step2_status === 'in_progress'
    if (filter === 'awaiting_invoice') return project.workflow_step === 4 && project.step4_status === 'in_progress'
    return true
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Projects</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Active</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.active}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {isManager && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Pending Approval</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pendingApproval}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        )}

        {isManager && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Awaiting Invoice</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.awaitingInvoice}</p>
                </div>
                <Upload className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          {isManager && <TabsTrigger value="pending_approval">Pending Approval</TabsTrigger>}
          {isManager && <TabsTrigger value="awaiting_invoice">Awaiting Invoice</TabsTrigger>}
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredProjects.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">No projects found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProjects.map((project) => {
                const actionLabel = getActionForProject(project)
                
                return (
                  <Card 
                    key={project.id} 
                    className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{project.project_name}</h3>
                            <Badge className={getStatusColor(project.status)}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                            {getWorkflowStepBadge(project)}
                            {project.invoice_file_url && (
                              <Badge variant="outline">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Invoice Uploaded
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>{project.client_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(project.created_at), 'MMM d, yyyy')}</span>
                            </div>
                            {project.total_amount && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <DollarSign className="h-4 w-4" />
                                <span>${project.total_amount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>

                          {/* Workflow Progress */}
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Workflow Progress</span>
                              <span className="font-medium">Step {project.workflow_step} of 5</span>
                            </div>
                            <Progress 
                              value={(project.workflow_step / 5) * 100} 
                              className="h-2"
                            />
                          </div>

                          {actionLabel && (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/projects/${project.id}`)
                                }}
                              >
                                {actionLabel}
                              </Button>
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/projects/${project.id}`)
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {isManager && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/projects/${project.id}/edit`)
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Project
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}