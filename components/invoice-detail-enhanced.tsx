'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReactToPrint } from 'react-to-print'
import { Download, Printer, FileText, History, Trash2 } from 'lucide-react'
import { Database } from '@/types/database'
import { ServiceInvoiceTemplate } from './service-invoice-template'
import { InvoiceApprovalFlow } from './invoice-approval-flow'
import { ManagerInvoiceActions } from './manager-invoice-actions'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
type Workspace = Database['public']['Tables']['workspaces']['Row']

interface InvoiceDetailEnhancedProps {
  invoice: Invoice
  userRole: 'user' | 'manager' | 'admin'
  currentUserId: string
  onUpdate: () => void
  onClose: () => void
}

export function InvoiceDetailEnhanced({ 
  invoice, 
  userRole, 
  currentUserId,
  onUpdate, 
  onClose 
}: InvoiceDetailEnhancedProps) {
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [activityLog, setActivityLog] = useState<Array<{
    id: string
    action: string
    created_at: string
    profiles?: {
      email: string
      full_name: string | null
    }
  }>>([])
  const componentRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const isOwner = invoice.submitted_by === currentUserId

  useEffect(() => {
    fetchInvoiceItems()
    fetchActivityLog()
    fetchWorkspace()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])

  const fetchInvoiceItems = async () => {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setItems(data)
    }
  }

  const fetchWorkspace = async () => {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', invoice.workspace_id)
      .single()
    
    if (data) {
      setWorkspace(data)
    }
  }

  const fetchActivityLog = async () => {
    // Fetch activity/audit log for this invoice
    const { data, error } = await supabase
      .from('invoice_activity')
      .select(`
        *,
        profiles!user_id (
          email,
          full_name
        )
      `)
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: false })

    // Handle errors gracefully
    if (error) {
      console.log('Error fetching activity log:', error.message)
      // Try simpler query without joins as fallback
      const { data: simpleData } = await supabase
        .from('invoice_activity')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false })
      
      if (simpleData) {
        // Map the data to include placeholder user info
        const mappedData = simpleData.map(activity => ({
          ...activity,
          profiles: { email: 'User', full_name: null }
        }))
        setActivityLog(mappedData)
      } else {
        setActivityLog([])
      }
    } else if (data) {
      setActivityLog(data)
    }
  }

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Invoice-${invoice.invoice_number}`,
  })

  const downloadAsJSON = () => {
    const invoiceData = {
      invoice,
      items,
      exported_at: new Date().toISOString()
    }

    const dataStr = JSON.stringify(invoiceData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `invoice-${invoice.invoice_number}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleDeleteInvoice = async () => {
    // Delete invoice items first
    await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoice.id)

    // Then delete the invoice
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoice.id)

    if (!error) {
      onUpdate()
      onClose()
    }
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'submitted': return 'default'
      case 'awaiting_approval': return 'outline'
      case 'approved': return 'default'
      case 'processing': return 'default'
      case 'completed': return 'default'
      case 'rejected': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStatusLabel = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'submitted': return 'Submitted'
      case 'awaiting_approval': return 'Awaiting Approval'
      case 'approved': return 'Approved'
      case 'processing': return 'Processing'
      case 'completed': return 'Completed'
      case 'rejected': return 'Rejected'
      default: return status
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice {invoice.invoice_number}</span>
            <Badge variant={getStatusColor(invoice.status)}>
              {getStatusLabel(invoice.status)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Manage and track invoice through the approval process
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">
              <FileText className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="workflow">
              <History className="mr-2 h-4 w-4" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History className="mr-2 h-4 w-4" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAsJSON}>
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
            
            <div ref={componentRef}>
              {workspace && (
                <ServiceInvoiceTemplate
                  invoice={invoice}
                  items={items}
                  workspace={workspace}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            {/* Show internal notes if they exist */}
            {invoice.notes && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Internal Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}
            
            {/* Manager actions for submitted invoices - only available for manager role */}
            {console.log('Invoice detail - userRole:', userRole, 'status:', invoice.status)}
            {userRole === 'manager' && invoice.status === 'submitted' && (
              <ManagerInvoiceActions
                invoice={invoice}
                onUpdate={() => {
                  onUpdate()
                  fetchActivityLog()
                }}
              />
            )}
            
            {/* Regular approval flow */}
            <InvoiceApprovalFlow
              invoice={invoice}
              userRole={userRole}
              isOwner={isOwner}
              onUpdate={() => {
                onUpdate()
                fetchActivityLog()
              }}
            />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
              </CardHeader>
              <CardContent>
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                ) : (
                  <div className="space-y-4">
                    {activityLog.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 text-sm">
                        <div className="flex-shrink-0 w-2 h-2 mt-1.5 bg-gray-400 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {activity.profiles?.full_name || activity.profiles?.email || 'System'}
                          </p>
                          <p className="text-muted-foreground">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div>
            {/* Only show delete for draft or rejected invoices and only for the owner */}
            {isOwner && (invoice.status === 'draft' || invoice.status === 'rejected') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Invoice
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the invoice
                      "{invoice.invoice_number}" and all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteInvoice}>
                      Delete Invoice
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}