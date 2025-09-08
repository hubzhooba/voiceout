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
  AlertCircle,
  MoreVertical,
  Eye,
  Edit,
  TrendingUp,
  Minus,
  Briefcase,
  CheckSquare,
  XCircle,
  Pause,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  created_by: string
  created_at: string
  updated_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface ProjectListProps {
  tentId: string
  userRole: string
}

export function ProjectList({ tentId, userRole }: ProjectListProps) {
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
    pendingInvoices: 0,
    overduePayments: 0
  })
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

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
      const active = data?.filter(p => ['planning', 'in_progress', 'review'].includes(p.status)).length || 0
      const completed = data?.filter(p => p.status === 'completed').length || 0
      const totalValue = data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0
      const pendingInvoices = data?.filter(p => p.requires_invoice && p.invoice_status === 'submitted').length || 0
      const today = new Date()
      const overduePayments = data?.filter(p => {
        if (!p.payment_due_date || p.payment_status === 'paid') return false
        return new Date(p.payment_due_date) < today
      }).length || 0

      setStats({
        total: data?.length || 0,
        active,
        completed,
        totalValue,
        pendingInvoices,
        overduePayments
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
    
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
      
      if (error) throw error
      
      // Immediately remove from state for instant feedback
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId))
      
      toast({
        title: 'Project Deleted',
        description: `"${projectName}" has been permanently deleted.`,
      })
      
      setDeleteModalOpen(false)
      setProjectToDelete(null)
      
      // Also fetch fresh data to ensure sync with database
      setTimeout(() => {
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
      fetchProjects()
    }
  }

  const getFilteredProjects = () => {
    switch (filter) {
      case 'active':
        return projects.filter(p => ['planning', 'in_progress', 'review'].includes(p.status))
      case 'completed':
        return projects.filter(p => p.status === 'completed')
      case 'invoiced':
        return projects.filter(p => p.requires_invoice)
      case 'overdue':
        return projects.filter(p => {
          if (!p.payment_due_date || p.payment_status === 'paid') return false
          return new Date(p.payment_due_date) < new Date()
        })
      default:
        return projects
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning':
        return <Clock className="h-4 w-4" />
      case 'in_progress':
        return <TrendingUp className="h-4 w-4" />
      case 'review':
        return <Eye className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'on_hold':
        return <Pause className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <Minus className="h-4 w-4" />
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const handleStatusUpdate = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', projectId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Project status updated'
      })

      fetchProjects()
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update project status',
        variant: 'destructive'
      })
    }
  }

  const filteredProjects = getFilteredProjects()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">${stats.totalValue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingInvoices}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overduePayments}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="invoiced">With Invoice</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="space-y-4">
            {filteredProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">No projects found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filter === 'all' ? 'Create your first project to get started' : `No ${filter} projects`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold">{project.project_name}</h3>
                              <Badge className={getStatusColor(project.status)}>
                                {getStatusIcon(project.status)}
                                <span className="ml-1 capitalize">{project.status.replace('_', ' ')}</span>
                              </Badge>
                              <Badge className={getPriorityColor(project.priority)}>
                                {project.priority}
                              </Badge>
                              {project.requires_invoice && (
                                <Badge variant="outline">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Invoice Required
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              #{project.project_number} • {project.client_name}
                            </p>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Project
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => openDeleteModal(project.id, project.project_name)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Project
                              </DropdownMenuItem>
                              {userRole !== 'client' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleStatusUpdate(project.id, 'in_progress')}
                                    disabled={project.status === 'in_progress'}
                                  >
                                    Start Project
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleStatusUpdate(project.id, 'completed')}
                                    disabled={project.status === 'completed'}
                                  >
                                    Mark Complete
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleStatusUpdate(project.id, 'on_hold')}
                                    disabled={project.status === 'on_hold'}
                                  >
                                    Put On Hold
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Description */}
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        )}

                        {/* Progress Bar */}
                        {project.total_tasks > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                <CheckSquare className="h-4 w-4 inline mr-1" />
                                {project.completed_tasks} of {project.total_tasks} tasks
                              </span>
                              <span className="font-medium">{project.progress_percentage}%</span>
                            </div>
                            <Progress value={project.progress_percentage} className="h-2" />
                          </div>
                        )}

                        {/* Footer Info */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'Not started'}
                            </span>
                            {project.end_date && (
                              <span>
                                → {format(new Date(project.end_date), 'MMM d, yyyy')}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {project.profiles?.full_name || project.profiles?.email || 'Unknown'}
                            </span>
                          </div>

                          {/* Financial Info */}
                          {project.requires_invoice && (
                            <div className="flex items-center gap-3">
                              {project.total_amount && (
                                <span className="font-semibold">
                                  ${project.total_amount.toFixed(2)}
                                </span>
                              )}
                              {project.invoice_status && project.invoice_status !== 'not_required' && (
                                <Badge variant={
                                  project.invoice_status === 'approved' ? 'default' :
                                  project.invoice_status === 'submitted' ? 'secondary' :
                                  'outline'
                                }>
                                  {project.invoice_status}
                                </Badge>
                              )}
                              {project.payment_status && (
                                <Badge variant={
                                  project.payment_status === 'paid' ? 'default' :
                                  project.payment_status === 'overdue' ? 'destructive' :
                                  'outline'
                                }>
                                  {project.payment_status}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                    <span>
                      This action cannot be undone. This will permanently delete the project and all associated data including:
                    </span>
                  </p>
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