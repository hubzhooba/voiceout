'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge' // Unused
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { 
  Coins, 
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
  Activity,
  Trash2,
  Pause,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  onProjectsChange?: () => void
}

export function ProjectListEnhanced({ tentId, userRole, userId, onProjectsChange }: ProjectListEnhancedProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
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
    console.log('fetchProjects called for tent:', tentId)
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

      if (error) {
        console.error('fetchProjects error:', error)
        throw error
      }

      console.log('fetchProjects received data:', data?.length, 'projects')
      console.log('Project IDs:', data?.map(p => p.id))
      setProjects(data || [])
      
      // Calculate stats
      const active = data?.filter(p => {
        // Active = workflow steps 1-3 or status in_progress/review
        return (p.workflow_step >= 1 && p.workflow_step <= 3) || 
               p.status === 'in_progress' || 
               p.status === 'review'
      }).length || 0
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
  
  const openDeleteModal = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName })
    setDeleteModalOpen(true)
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) return
    
    const { id: projectId, name: projectName } = projectToDelete
    console.log('Delete confirmed for project:', projectId, projectName)
    console.log('Projects before delete:', projects.length, projects.map(p => p.id))
    
    try {
      console.log('Sending delete request to Supabase...')
      const { data: deleteData, error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select()
      
      if (error) {
        console.error('Supabase delete error:', error)
        throw error
      }
      
      console.log('Delete successful, deleted records:', deleteData)
      
      // Verify the project was actually deleted
      const { data: verifyData } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .maybeSingle()
      
      console.log('Verification after delete - project found?:', verifyData)
      if (verifyData) {
        console.error('WARNING: Project still exists after delete!', verifyData)
      }
      
      console.log('Delete successful, updating state...')
      // Immediately remove from state for instant feedback
      setProjects(prevProjects => {
        const filtered = prevProjects.filter(p => p.id !== projectId)
        console.log('Projects after filter:', filtered.length, filtered.map(p => p.id))
        return filtered
      })
      
      toast({
        title: 'Project Deleted',
        description: `"${projectName}" has been permanently deleted.`,
      })
      
      setDeleteModalOpen(false)
      setProjectToDelete(null)
      
      // Notify parent component of change
      if (onProjectsChange) {
        onProjectsChange()
      }
      
      // Also fetch fresh data to ensure sync with database
      console.log('Scheduling data refresh...')
      setTimeout(() => {
        console.log('Fetching fresh project data...')
        fetchProjects()
      }, 500)
    } catch (error) {
      console.error('Error deleting project:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete project. Please try again.',
        variant: 'destructive'
      })
      // Refresh on error to ensure state is in sync
      console.log('Fetching projects due to error...')
      fetchProjects()
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

    return (
      <div className="flex items-center gap-1.5">
        {/* Progress dots */}
        <div className="flex items-center gap-0.5">
          {steps.map((step, index) => (
            <div
              key={step.num}
              className={`h-1.5 w-1.5 rounded-full transition-all ${
                index < project.workflow_step - 1
                  ? 'bg-green-500'
                  : index === project.workflow_step - 1
                  ? currentStep.status === 'completed' 
                    ? 'bg-green-500'
                    : 'bg-blue-500 animate-pulse'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {currentStep.label}
        </span>
      </div>
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
        return 'bg-gray-500/10 text-gray-700 dark:bg-gray-400/10 dark:text-gray-300 border-gray-200 dark:border-gray-700'
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300 border-blue-200 dark:border-blue-700'
      case 'review':
        return 'bg-yellow-500/10 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700'
      case 'completed':
        return 'bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-300 border-green-200 dark:border-green-700'
      case 'on_hold':
        return 'bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300 border-orange-200 dark:border-orange-700'
      case 'cancelled':
        return 'bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300 border-red-200 dark:border-red-700'
      default:
        return 'bg-gray-500/10 text-gray-700 dark:bg-gray-400/10 dark:text-gray-300 border-gray-200 dark:border-gray-700'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning':
        return <Clock className="h-3 w-3" />
      case 'in_progress':
        return <Activity className="h-3 w-3" />
      case 'review':
        return <Eye className="h-3 w-3" />
      case 'completed':
        return <CheckCircle className="h-3 w-3" />
      case 'on_hold':
        return <Pause className="h-3 w-3" />
      case 'cancelled':
        return <X className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }


  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true
    if (filter === 'active') {
      // Active = workflow steps 1-3 or status in_progress/review
      // Exclude completed projects
      const isActive = ((project.workflow_step >= 1 && project.workflow_step <= 3) || 
                       project.status === 'in_progress' || 
                       project.status === 'review') &&
                       project.status !== 'completed' &&
                       project.workflow_step !== 5
      return isActive
    }
    if (filter === 'completed') return project.status === 'completed' || project.workflow_step === 5
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
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 hover-card">
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

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 hover-card">
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
          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 hover-card">
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
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 hover-card">
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
        <TabsList className={`grid w-full ${isManager ? 'grid-cols-5' : 'grid-cols-3'}`}>
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          {isManager && <TabsTrigger value="pending_approval">Pending Approval</TabsTrigger>}
          {isManager && <TabsTrigger value="awaiting_invoice">Awaiting Invoice</TabsTrigger>}
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredProjects.length === 0 ? (
            <Card className="border-0 shadow-lg hover-card">
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
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    prefetch={true}
                    className="block"
                  >
                    <Card 
                      className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
                    >
                      <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{project.project_name}</h3>
                            {/* Clean status badge */}
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                              {getStatusIcon(project.status)}
                              <span className="capitalize">{project.status.replace('_', ' ')}</span>
                            </div>
                            {/* Workflow progress */}
                            {getWorkflowStepBadge(project)}
                            {/* Invoice indicator */}
                            {project.invoice_file_url && (
                              <div className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                <span>Invoice</span>
                              </div>
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
                                <Coins className="h-4 w-4" />
                                <span>{formatCurrency(project.total_amount)}</span>
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
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/projects/${project.id}/edit`)
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Project
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                openDeleteModal(project.id, project.project_name)
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete <span className="font-semibold">&quot;{projectToDelete?.name}&quot;</span>?
                </p>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="text-sm text-amber-800 dark:text-amber-200 font-medium flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                    <span>
                      This action cannot be undone. This will permanently delete the project and all associated data including:
                    </span>
                  </div>
                  <ul className="ml-7 mt-2 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
                    <li>Project details and settings</li>
                    <li>All project items and tasks</li>
                    <li>Comments and activity history</li>
                    <li>Associated files and documents</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProjectToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}