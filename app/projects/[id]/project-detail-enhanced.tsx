'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ProjectWorkflowSteps } from '@/components/project/project-workflow-steps'
import { ProjectAttachments } from '@/components/project/project-attachments'
import { InvoiceUploadModal } from '@/components/project/invoice-upload-modal'
import { formatCurrency } from '@/lib/currency'
import { 
  ArrowLeft,
  Edit,
  Calendar,
  Briefcase,
  Hash,
  Receipt,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download
} from 'lucide-react'

interface ProjectDetailEnhancedProps {
  project: Record<string, unknown>
  currentUserId: string
  userRole: string
  isAdmin: boolean
}

export function ProjectDetailEnhanced({ project, currentUserId, userRole, isAdmin }: ProjectDetailEnhancedProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('workflow')
  const [showInvoiceUpload, setShowInvoiceUpload] = useState(false)

  const isManager = userRole === 'manager' || isAdmin
  const isCreator = project.created_by === currentUserId
  const currentStep = (project.workflow_step as number) || 1
  
  // Parse metadata for additional fields
  const metadata = typeof project.metadata === 'string' 
    ? JSON.parse(project.metadata) 
    : project.metadata || {}
  
  // Debug logging
  console.log('Project data:', {
    client_name: project.client_name,
    client_email: project.client_email,
    client_phone: project.client_phone,
    client_address: project.client_address,
    client_tin: project.client_tin,
    metadata: metadata,
    raw_metadata: project.metadata
  })

  // Handle workflow step actions
  const handleStepAction = async (step: number) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      let result
      switch (step) {
        case 1:
          // Complete project creation and submit for approval
          result = await supabase.rpc('complete_project_step1', {
            p_project_id: project.id as string,
            p_user_id: user.id
          })
          
          if (result.error) throw result.error
          
          toast({
            title: 'Project Submitted',
            description: 'Your project has been submitted for manager approval'
          })
          break

        case 2:
          // Manager approves project
          result = await supabase.rpc('approve_project_step2', {
            p_project_id: project.id as string,
            p_user_id: user.id
          })
          
          if (result.error) throw result.error
          
          toast({
            title: 'Project Approved',
            description: 'The project information has been approved'
          })
          break

        case 3:
          // User requests invoice
          result = await supabase.rpc('request_invoice_step3', {
            p_project_id: project.id as string,
            p_user_id: user.id
          })
          
          if (result.error) throw result.error
          
          toast({
            title: 'Invoice Requested',
            description: 'A written service invoice has been requested from the manager'
          })
          break

        case 4:
          // Open invoice upload modal
          setShowInvoiceUpload(true)
          setLoading(false)
          return
          
        case 5:
          // User accepts and completes project
          if (!project.invoice_file_url) {
            toast({
              title: 'Invoice Required',
              description: 'Please wait for the manager to upload the invoice before accepting',
              variant: 'destructive'
            })
            setLoading(false)
            return
          }

          result = await supabase.rpc('accept_project_step5', {
            p_project_id: project.id as string,
            p_user_id: user.id
          })
          
          if (result.error) throw result.error
          
          toast({
            title: 'Project Completed',
            description: 'The project has been accepted and marked as complete'
          })
          break
      }

      // Refresh the page to show updated data
      router.refresh()
    } catch (error) {
      console.error('Error updating workflow step:', error)
      toast({
        title: 'Error',
        description: 'Failed to update workflow step. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle invoice upload completion
  const handleInvoiceUploadComplete = async (fileUrl: string, fileName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const result = await supabase.rpc('upload_invoice_step4', {
        p_project_id: project.id as string,
        p_user_id: user.id,
        p_file_url: fileUrl,
        p_file_name: fileName
      })
      
      if (result.error) throw result.error
      
      toast({
        title: 'Invoice Uploaded',
        description: 'The service invoice has been uploaded successfully'
      })

      setShowInvoiceUpload(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating invoice status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update invoice status',
        variant: 'destructive'
      })
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
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

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
                      Created {format(new Date(project.created_at as string), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                {isManager && currentStep < 5 ? (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/projects/${project.id as string}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Project
                  </Button>
                ) : null}
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Show alerts based on current step */}
        {currentStep === 1 && !isCreator ? (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Waiting for the client to submit project information for approval.
            </AlertDescription>
          </Alert>
        ) : null}

        {currentStep === 2 && !isManager ? (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your project is pending manager approval. You&apos;ll be notified once it&apos;s approved.
            </AlertDescription>
          </Alert>
        ) : null}

        {currentStep === 4 && !isManager ? (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Waiting for the manager to upload the written service invoice.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Main Content */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="invoice">Invoice</TabsTrigger>
              </TabsList>

              {/* Workflow Tab */}
              <TabsContent value="workflow" className="space-y-6">
                <ProjectWorkflowSteps
                  project={project}
                  currentUserId={currentUserId}
                  userRole={userRole as 'client' | 'manager'}
                  isAdmin={isAdmin}
                  onStepAction={handleStepAction}
                  loading={loading}
                />

                {currentStep === 5 && project.invoice_file_url ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Project Invoice</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Receipt className="h-6 w-6 text-green-600" />
                          <div>
                            <p className="font-medium">{project.invoice_file_name as string}</p>
                            <p className="text-sm text-muted-foreground">
                              Uploaded on step 4 of the workflow
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => window.open(project.invoice_file_url as string, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Client Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {project.client_name ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Client Name</span>
                          <p className="font-medium">{project.client_name as string}</p>
                        </div>
                      ) : null}
                      {metadata?.client_company ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Registered Business Name</span>
                          <p className="font-medium">{metadata.client_company}</p>
                        </div>
                      ) : null}
                      {project.client_email ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Email</span>
                          <p className="font-medium">{project.client_email as string}</p>
                        </div>
                      ) : null}
                      {project.client_phone ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Phone</span>
                          <p className="font-medium">{project.client_phone as string}</p>
                        </div>
                      ) : null}
                      {project.client_address ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Business Address</span>
                          <p className="font-medium">{project.client_address as string}</p>
                        </div>
                      ) : null}
                      {(metadata?.client_tin || project.client_tin) ? (
                        <div>
                          <span className="text-sm text-muted-foreground">TIN (Tax Identification Number)</span>
                          <p className="font-medium">{metadata?.client_tin || project.client_tin as string}</p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Project Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Project Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <span className="text-sm text-muted-foreground">Type</span>
                        <p className="font-medium capitalize">{project.project_type as string}</p>
                      </div>
                      {project.description ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Description</span>
                          <p className="font-medium">{project.description as string}</p>
                        </div>
                      ) : null}
                      {project.start_date ? (
                        <div>
                          <span className="text-sm text-muted-foreground">Start Date</span>
                          <p className="font-medium">
                            {format(new Date(project.start_date as string), 'MMM d, yyyy')}
                          </p>
                        </div>
                      ) : null}
                      {project.end_date ? (
                        <div>
                          <span className="text-sm text-muted-foreground">End Date</span>
                          <p className="font-medium">
                            {format(new Date(project.end_date as string), 'MMM d, yyyy')}
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>


                {/* Invoice Details */}
                {(project.invoice_amount || project.total_amount || project.items || project.requires_invoice) ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Payment Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-muted-foreground">Payment Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          {project.is_cash_sale !== null ? (
                            <div>
                              <span className="text-xs text-muted-foreground">Payment Type</span>
                              <p className="font-medium">{project.is_cash_sale ? 'Cash Sale' : 'On Account (Invoice)'}</p>
                            </div>
                          ) : null}
                          {metadata.payment_terms ? (
                            <div>
                              <span className="text-xs text-muted-foreground">Payment Terms</span>
                              <p className="font-medium">{metadata.payment_terms}</p>
                            </div>
                          ) : null}
                          {project.requires_invoice ? (
                            <div>
                              <span className="text-xs text-muted-foreground">Invoice Required</span>
                              <p className="font-medium">Yes</p>
                            </div>
                          ) : null}
                          {metadata.withholding_tax_percent || project.withholding_tax_percent ? (
                            <div>
                              <span className="text-xs text-muted-foreground">Withholding Tax (%)</span>
                              <p className="font-medium">{metadata.withholding_tax_percent || project.withholding_tax_percent}%</p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Invoice Items */}
                      {project.items && Array.isArray(project.items) && (project.items as Array<Record<string, unknown>>).length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-muted-foreground">Invoice Items</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 text-sm font-medium text-muted-foreground">Description</th>
                                  <th className="text-center py-2 text-sm font-medium text-muted-foreground w-20">Qty</th>
                                  <th className="text-right py-2 text-sm font-medium text-muted-foreground w-28">Unit Price</th>
                                  <th className="text-right py-2 text-sm font-medium text-muted-foreground w-28">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(project.items as Array<Record<string, unknown>>).map((item, index) => {
                                  const quantity = Number(item.quantity) || 1
                                  const unitPrice = Number(item.unit_price) || 0
                                  const amount = quantity * unitPrice
                                  
                                  return (
                                    <tr key={index} className="border-b">
                                      <td className="py-2">{item.description as string}</td>
                                      <td className="py-2 text-center">{quantity}</td>
                                      <td className="py-2 text-right">{formatCurrency(unitPrice)}</td>
                                      <td className="py-2 text-right font-medium">{formatCurrency(amount)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {/* Financial Summary */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground mb-3">Financial Summary</h4>
                        {project.invoice_amount ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">{formatCurrency(project.invoice_amount as number || 0)}</span>
                          </div>
                        ) : null}
                        {project.tax_amount ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span className="font-medium">{formatCurrency(project.tax_amount as number || 0)}</span>
                          </div>
                        ) : null}
                        {project.withholding_tax ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Withholding Tax {project.withholding_tax_percent ? `(${project.withholding_tax_percent}%)` : ''}
                            </span>
                            <span className="font-medium text-red-600">
                              -{formatCurrency(project.withholding_tax as number || 0)}
                            </span>
                          </div>
                        ) : null}
                        {project.total_amount ? (
                          <>
                            <div className="border-t pt-2 mt-2" />
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total Amount</span>
                              <span className="text-green-600">{formatCurrency(project.total_amount as number || 0)}</span>
                            </div>
                          </>
                        ) : null}
                      </div>

                      {/* Invoice Status */}
                      {project.invoice_file_url ? (
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Invoice Document Available
                            </span>
                          </div>
                        </div>
                      ) : null}
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
                      <p className="whitespace-pre-wrap">{project.notes as string}</p>
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

              {/* Invoice Tab */}
              <TabsContent value="invoice" className="space-y-4">
                {project.invoice_file_url ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        Service Invoice
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                              <div>
                                <p className="font-medium">{project.invoice_file_name as string}</p>
                                <p className="text-sm text-muted-foreground">
                                  Uploaded on {project.step4_uploaded_at ? 
                                    format(new Date(project.step4_uploaded_at as string), 'MMM d, yyyy h:mm a') : 
                                    'Unknown date'}
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={() => window.open(project.invoice_file_url as string, '_blank')}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Invoice
                            </Button>
                          </div>
                        </div>

                        {currentStep === 5 && isCreator && project.step5_status !== 'completed' ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Please review the invoice and accept it to complete the project.
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {project.step5_status === 'completed' ? (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                            <p className="text-sm">
                              <span className="font-medium">Project completed on </span>
                              {project.step5_accepted_at ? 
                                format(new Date(project.step5_accepted_at as string), 'MMM d, yyyy h:mm a') : 
                                'Unknown date'}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground mb-2">No invoice uploaded yet</p>
                      {currentStep < 4 ? (
                        <p className="text-sm text-muted-foreground">
                          Invoice will be available after step 3 is completed
                        </p>
                      ) : null}
                      {currentStep === 4 && isManager ? (
                        <Button
                          onClick={() => setShowInvoiceUpload(true)}
                          className="mt-4"
                        >
                          Upload Invoice
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Upload Modal */}
      <InvoiceUploadModal
        open={showInvoiceUpload}
        onClose={() => setShowInvoiceUpload(false)}
        projectId={project.id as string}
        projectName={project.project_name as string}
        onUploadComplete={handleInvoiceUploadComplete}
      />
    </div>
  )
}