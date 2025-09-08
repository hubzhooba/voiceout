'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ProjectAttachments } from '@/components/project/project-attachments'
import { formatCurrency } from '@/lib/currency'
import { 
  ArrowLeft,
  Edit,
  FileText,
  Calendar,
  User,
  CheckCircle,
  MessageSquare,
  Activity,
  Briefcase,
  Hash,
  Mail,
  Phone,
  MapPin,
  Receipt
} from 'lucide-react'

interface ProjectDetailViewProps {
  project: Record<string, unknown>
  currentUserId: string
  userRole: string
  isAdmin: boolean
}

export function ProjectDetailView({ project, currentUserId, userRole, isAdmin }: ProjectDetailViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // const handleStatusUpdate = async (newStatus: string) => {
  //   setLoading(true)
  //   try {
  //     const { error } = await supabase
  //       .from('projects')
  //       .update({ 
  //         status: newStatus,
  //         updated_at: new Date().toISOString()
  //       })
  //       .eq('id', project.id)

  //     if (error) throw error

  //     toast({
  //       title: 'Success',
  //       description: 'Project status updated'
  //     })

  //     router.refresh()
  //   } catch (error) {
  //     console.error('Error updating status:', error)
  //     toast({
  //       title: 'Error',
  //       description: 'Failed to update project status',
  //       variant: 'destructive'
  //     })
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const handleApproveInvoice = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('projects')
        .update({ 
          invoice_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Invoice approved successfully'
      })

      router.refresh()
    } catch (error) {
      console.error('Error approving invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to approve invoice',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRejectInvoice = async (reason: string) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('projects')
        .update({ 
          invoice_status: 'rejected',
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)

      if (error) throw error

      toast({
        title: 'Invoice Rejected',
        description: 'The invoice has been rejected'
      })

      router.refresh()
    } catch (error) {
      console.error('Error rejecting invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to reject invoice',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
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

  // Calculate totals
  const subtotal = (project.project_items as Array<Record<string, unknown>> | undefined)?.reduce((sum: number, item) => 
    sum + ((item.amount as number) || 0), 0) || 0
  const withholding = (subtotal * ((project.withholding_tax_percent as number) || 0)) / 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">{project.project_name as string}</h1>
                    <Badge className={getStatusColor(project.status as string)}>
                      {(project.status as string).replace('_', ' ')}
                    </Badge>
                    {project.priority ? (
                      <Badge className={getPriorityColor(project.priority as string)}>
                        {project.priority as string} priority
                      </Badge>
                    ) : null}
                    {project.requires_invoice ? (
                      <Badge variant="outline">
                        <Receipt className="h-3 w-3 mr-1" />
                        Invoice Required
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      {project.project_number as string}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {((project.tents as Record<string, unknown>)?.name as string) || ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {project.start_date ? format(new Date(project.start_date as string), 'MMM d, yyyy') : 'Not started'}
                    </span>
                  </div>
                </div>

                {(userRole === 'manager' || isAdmin) ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/projects/${project.id as string}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    {project.requires_invoice && (project.invoice_status as string) === 'submitted' ? (
                      <>
                        <Button
                          variant="default"
                          onClick={handleApproveInvoice}
                          disabled={loading}
                        >
                          Approve Invoice
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            const reason = prompt('Rejection reason:')
                            if (reason) handleRejectInvoice(reason)
                          }}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Client Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{project.client_name as string}</span>
                      </div>
                      {project.client_email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{project.client_email as string}</span>
                        </div>
                      ) : null}
                      {project.client_phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{project.client_phone as string}</span>
                        </div>
                      ) : null}
                      {project.client_address ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-sm">{project.client_address as string}</span>
                        </div>
                      ) : null}
                      {project.client_tin ? (
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span>TIN: {project.client_tin as string}</span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Financial Summary */}
                  {project.requires_invoice ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Financial Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax</span>
                          <span className="font-medium">{formatCurrency((project.tax_amount as number) || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Withholding ({project.withholding_tax_percent as number}%)</span>
                          <span className="font-medium text-red-600">-{formatCurrency(withholding)}</span>
                        </div>
                        <div className="border-t pt-3">
                          <div className="flex justify-between">
                            <span className="font-semibold">Total</span>
                            <span className="font-bold text-lg">{formatCurrency((project.total_amount as number) || 0)}</span>
                          </div>
                        </div>
                        <div className="pt-2">
                          <Badge variant={(project.is_cash_sale as boolean) ? 'default' : 'secondary'}>
                            {(project.is_cash_sale as boolean) ? 'Cash Sale' : 'Credit Sale'}
                          </Badge>
                          {project.payment_status ? (
                            <Badge 
                              variant={(project.payment_status as string) === 'paid' ? 'default' : 'outline'}
                              className="ml-2"
                            >
                              {project.payment_status as string}
                            </Badge>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>

                {/* Description */}
                {project.description ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{project.description as string}</p>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Progress */}
                {(project.total_tasks as number) > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{project.completed_tasks as number} of {project.total_tasks as number} tasks completed</span>
                          <span className="font-medium">{project.progress_percentage as number}%</span>
                        </div>
                        <Progress value={project.progress_percentage as number} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Notes */}
                {project.notes ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes as string}</p>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              {/* Files Tab */}
              <TabsContent value="files" className="space-y-4">
                <ProjectAttachments 
                  projectId={project.id as string}
                  currentUserId={currentUserId}
                  userRole={userRole}
                  isAdmin={isAdmin}
                />
              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="space-y-4">
                {project.project_items && (project.project_items as Array<unknown>).length > 0 ? (
                  <div className="space-y-3">
                    {(project.project_items as Array<Record<string, unknown>>).map((item) => (
                      <Card key={item.id as string}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{item.description as string}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>Qty: {item.quantity as number}</span>
                                {item.unit_price ? (
                                  <>
                                    <span>Unit Price: {formatCurrency(item.unit_price as number)}</span>
                                    <span className="font-medium">Amount: {formatCurrency(item.amount as number)}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <Badge variant={(item.status as string) === 'completed' ? 'default' : 'secondary'}>
                              {item.status as string}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">No items added</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="space-y-4">
                {project.project_tasks && (project.project_tasks as Array<unknown>).length > 0 ? (
                  <div className="space-y-3">
                    {(project.project_tasks as Array<Record<string, unknown>>).map((task) => (
                      <Card key={task.id as string}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{task.title as string}</p>
                              {task.description ? (
                                <p className="text-sm text-muted-foreground mt-1">{task.description as string}</p>
                              ) : null}
                              <div className="flex items-center gap-3 mt-2">
                                <Badge className={getPriorityColor(task.priority as string)}>
                                  {task.priority as string}
                                </Badge>
                                <Badge variant={(task.status as string) === 'done' ? 'default' : 'secondary'}>
                                  {task.status as string}
                                </Badge>
                                {task.due_date ? (
                                  <span className="text-sm text-muted-foreground">
                                    Due: {format(new Date(task.due_date as string), 'MMM d')}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">No tasks created</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments" className="space-y-4">
                {project.project_comments && (project.project_comments as Array<unknown>).length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {(project.project_comments as Array<Record<string, unknown>>).map((comment) => (
                        <Card key={comment.id as string}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span className="font-medium text-sm">
                                  {(comment.profiles as Record<string, unknown>)?.full_name as string || (comment.profiles as Record<string, unknown>)?.email as string || 'Unknown'}
                                </span>
                                {comment.is_internal ? (
                                  <Badge variant="outline" className="text-xs">Internal</Badge>
                                ) : null}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at as string), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm">{comment.comment as string}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">No comments yet</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-4">
                {project.project_activity && (project.project_activity as Array<unknown>).length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {(project.project_activity as Array<Record<string, unknown>>).map((activity) => (
                        <Card key={activity.id as string}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <div className="flex-1">
                                <p className="text-sm">{activity.description as string}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {(activity.profiles as Record<string, unknown>)?.full_name as string || (activity.profiles as Record<string, unknown>)?.email as string || 'System'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(activity.created_at as string), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">No activity recorded</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}