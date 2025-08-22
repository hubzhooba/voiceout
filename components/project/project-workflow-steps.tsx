'use client'

import { Check, Circle, Clock, Upload, FileCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface WorkflowStep {
  number: number
  title: string
  description: string
  status: 'completed' | 'in_progress' | 'pending' | 'skipped'
  completedAt?: string
  completedBy?: {
    full_name?: string
    email: string
  }
  action?: () => void
  actionLabel?: string
  canPerformAction?: boolean
}

interface ProjectWorkflowStepsProps {
  project: Record<string, unknown>
  currentUserId: string
  userRole: 'client' | 'manager'
  isAdmin: boolean
  onStepAction: (step: number, action: string) => Promise<void>
  loading?: boolean
}

export function ProjectWorkflowSteps({
  project,
  currentUserId,
  userRole,
  isAdmin,
  onStepAction,
  loading = false
}: ProjectWorkflowStepsProps) {
  const currentStep = (project.workflow_step as number) || 1
  const isManager = userRole === 'manager' || isAdmin
  const isCreator = project.created_by === currentUserId

  // Define the workflow steps
  const steps: WorkflowStep[] = [
    {
      number: 1,
      title: 'Project Created',
      description: 'User creates and submits project information',
      status: (project.step1_status as 'completed' | 'in_progress' | 'pending') || 'pending',
      completedAt: project.step1_completed_at as string,
      completedBy: project.step1_completed_by as { full_name?: string; email: string },
      action: currentStep === 1 && isCreator ? () => onStepAction(1, 'complete') : undefined,
      actionLabel: 'Submit for Approval',
      canPerformAction: isCreator
    },
    {
      number: 2,
      title: 'Manager Approval',
      description: 'Manager reviews and approves project information',
      status: (project.step2_status as 'completed' | 'in_progress' | 'pending') || 'pending',
      completedAt: project.step2_approved_at as string,
      completedBy: project.step2_approved_by as { full_name?: string; email: string },
      action: currentStep === 2 && isManager ? () => onStepAction(2, 'approve') : undefined,
      actionLabel: 'Approve Project',
      canPerformAction: isManager
    },
    {
      number: 3,
      title: 'Request Invoice',
      description: 'User initiates request for written service invoice',
      status: (project.step3_status as 'completed' | 'in_progress' | 'pending') || 'pending',
      completedAt: project.step3_requested_at as string,
      completedBy: project.step3_requested_by as { full_name?: string; email: string },
      action: currentStep === 3 && isCreator ? () => onStepAction(3, 'request') : undefined,
      actionLabel: 'Request Invoice',
      canPerformAction: isCreator
    },
    {
      number: 4,
      title: 'Upload Invoice',
      description: 'Manager uploads the written service invoice',
      status: (project.step4_status as 'completed' | 'in_progress' | 'pending') || 'pending',
      completedAt: project.step4_uploaded_at as string,
      completedBy: project.step4_uploaded_by as { full_name?: string; email: string },
      action: currentStep === 4 && isManager ? () => onStepAction(4, 'upload') : undefined,
      actionLabel: 'Upload Invoice',
      canPerformAction: isManager
    },
    {
      number: 5,
      title: 'Accept & Complete',
      description: 'User accepts invoice and completes the project',
      status: (project.step5_status as 'completed' | 'in_progress' | 'pending') || 'pending',
      completedAt: project.step5_accepted_at as string,
      completedBy: project.step5_accepted_by as { full_name?: string; email: string },
      action: currentStep === 5 && isCreator ? () => onStepAction(5, 'accept') : undefined,
      actionLabel: 'Accept & Complete',
      canPerformAction: isCreator
    }
  ]

  const getStepIcon = (step: WorkflowStep) => {
    if (step.status === 'completed') {
      return <Check className="h-5 w-5 text-white" />
    }
    if (step.status === 'in_progress') {
      return <Clock className="h-5 w-5 text-white animate-pulse" />
    }
    return <Circle className="h-5 w-5 text-gray-400" />
  }

  const getStepColor = (step: WorkflowStep) => {
    if (step.status === 'completed') {
      return 'bg-green-600'
    }
    if (step.status === 'in_progress') {
      return 'bg-blue-600'
    }
    return 'bg-gray-300'
  }

  const getActionIcon = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        return <FileCheck className="h-4 w-4 mr-2" />
      case 2:
        return <CheckCircle2 className="h-4 w-4 mr-2" />
      case 3:
        return <FileCheck className="h-4 w-4 mr-2" />
      case 4:
        return <Upload className="h-4 w-4 mr-2" />
      case 5:
        return <CheckCircle2 className="h-4 w-4 mr-2" />
      default:
        return null
    }
  }

  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Project Workflow Progress</CardTitle>
          <Badge variant="outline">
            Step {currentStep} of 5
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="relative">
            <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -translate-y-1/2"></div>
            <div 
              className="absolute left-0 top-1/2 h-1 bg-green-600 -translate-y-1/2 transition-all duration-500"
              style={{ width: `${((steps.filter(s => s.status === 'completed').length) / 5) * 100}%` }}
            ></div>
            <div className="relative flex justify-between">
              {steps.map((step) => (
                <div key={step.number} className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    getStepColor(step)
                  )}>
                    {getStepIcon(step)}
                  </div>
                  <span className="text-xs mt-2 font-medium">{step.number}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current Step Details */}
          <div className="space-y-4">
            {steps.map((step) => {
              const isCurrentStep = step.number === currentStep
              const showDetails = step.status === 'in_progress' || step.status === 'completed'
              
              if (!showDetails && !isCurrentStep) return null

              return (
                <div
                  key={step.number}
                  className={cn(
                    "p-4 rounded-lg border transition-all duration-300",
                    isCurrentStep 
                      ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30" 
                      : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">
                          Step {step.number}: {step.title}
                        </h4>
                        {step.status === 'completed' && (
                          <Badge variant="default" className="bg-green-600">
                            Completed
                          </Badge>
                        )}
                        {step.status === 'in_progress' && (
                          <Badge variant="default" className="bg-blue-600">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                      
                      {step.status === 'completed' && step.completedAt && (
                        <p className="text-xs text-muted-foreground">
                          Completed on {format(new Date(step.completedAt), 'MMM d, yyyy h:mm a')}
                          {step.completedBy && (
                            <span> by {step.completedBy.full_name || step.completedBy.email}</span>
                          )}
                        </p>
                      )}

                      {step.status === 'in_progress' && !step.canPerformAction && (
                        <div className="flex items-center gap-2 mt-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            Waiting for {step.canPerformAction === false && isManager ? 'client' : 'manager'} action
                          </p>
                        </div>
                      )}
                    </div>

                    {step.action && step.status === 'in_progress' && (
                      <Button
                        onClick={step.action}
                        disabled={loading}
                        size="sm"
                        className="ml-4"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : (
                          getActionIcon(step.number)
                        )}
                        {step.actionLabel}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Next Action Hint */}
          {currentStep < 5 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Next Action Required
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {steps[currentStep - 1].canPerformAction
                      ? `You can ${steps[currentStep - 1].actionLabel?.toLowerCase()} to proceed to the next step.`
                      : `Waiting for ${steps[currentStep - 1].canPerformAction === false && isManager ? 'client' : 'manager'} to ${steps[currentStep - 1].actionLabel?.toLowerCase()}.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Completion Status */}
          {currentStep === 5 && project.status === 'completed' && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Project Completed
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    All workflow steps have been successfully completed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}