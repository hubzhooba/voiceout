'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Send, 
  Clock,
  Upload,
  Download,
  Eye
} from 'lucide-react'
import { Database } from '@/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

interface InvoiceApprovalFlowProps {
  invoice: Invoice
  userRole: 'user' | 'manager' | 'admin'
  isOwner: boolean // Is this the client who created the invoice
  onUpdate: () => void
}

export function InvoiceApprovalFlow({ 
  invoice, 
  userRole, 
  isOwner,
  onUpdate 
}: InvoiceApprovalFlowProps) {
  const [loading, setLoading] = useState(false)
  const [approvalNote, setApprovalNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  const updateInvoiceStatus = async (
    newStatus: Invoice['status'], 
    note?: string,
    additionalUpdates?: Record<string, unknown>
  ) => {
    setLoading(true)

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...additionalUpdates
    }

    if (note) {
      updates.processing_notes = note
    }

    // Set timestamps based on status
    if (newStatus === 'awaiting_approval') {
      updates.processed_at = new Date().toISOString()
      updates.processed_by = (await supabase.auth.getUser()).data.user?.id
    } else if (newStatus === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = (await supabase.auth.getUser()).data.user?.id
    } else if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoice.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: getStatusUpdateMessage(newStatus),
      })
      
      // Create notification for relevant parties
      await createNotification(newStatus)
      onUpdate()
    }

    setLoading(false)
  }

  const createNotification = async (status: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let targetUserId: string | null = null
    let message = ''

    switch (status) {
      case 'awaiting_approval':
        // Notify the client who created the invoice
        targetUserId = invoice.submitted_by
        message = 'Your invoice has been reviewed and is ready for your approval'
        break
      case 'approved':
        // Notify the manager
        targetUserId = invoice.processed_by
        message = 'Invoice has been approved by the client'
        break
      case 'rejected':
        // Notify the appropriate party
        targetUserId = userRole === 'user' ? invoice.processed_by : invoice.submitted_by
        message = `Invoice has been rejected: ${rejectionReason}`
        break
      case 'completed':
        // Notify the client
        targetUserId = invoice.submitted_by
        message = 'Your invoice has been sent to the billed client'
        break
    }

    if (targetUserId && targetUserId !== user.id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type: 'invoice_status',
          title: `Invoice ${invoice.invoice_number} - ${status.replace('_', ' ').toUpperCase()}`,
          message,
          related_id: invoice.id,
        })
    }
  }

  const uploadScannedInvoice = async () => {
    if (!scannedFile) return

    setLoading(true)

    const fileExt = scannedFile.name.split('.').pop()
    const fileName = `${invoice.id}-scanned-${Date.now()}.${fileExt}`
    const filePath = `invoices/${invoice.workspace_id}/${fileName}`

    // First, try to create the bucket if it doesn't exist
    await supabase.storage.createBucket('documents', {
      public: false,
      fileSizeLimit: 10485760 // 10MB
    })

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, scannedFile)

    if (uploadError) {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    // Get signed URL for private access
    const { data: urlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 year

    if (urlData?.signedUrl) {
      await updateInvoiceStatus('awaiting_approval', undefined, {
        scanned_invoice_url: urlData.signedUrl
      })
    }

    setScannedFile(null)
    setLoading(false)
  }

  const getStatusUpdateMessage = (status: string) => {
    switch (status) {
      case 'awaiting_approval':
        return 'Invoice sent for client approval'
      case 'approved':
        return 'Invoice approved successfully'
      case 'rejected':
        return 'Invoice rejected'
      case 'completed':
        return 'Invoice marked as completed and sent to client'
      default:
        return `Invoice status updated to ${status}`
    }
  }

  const downloadInvoice = async () => {
    if (!invoice.scanned_invoice_url) return
    window.open(invoice.scanned_invoice_url, '_blank')
  }

  // Determine what actions are available based on role and status
  const canUploadScanned = userRole === 'manager' && invoice.status === 'submitted'
  const canApprove = isOwner && invoice.status === 'awaiting_approval'
  const canReject = (
    (isOwner && invoice.status === 'awaiting_approval') ||
    (userRole === 'manager' && invoice.status === 'submitted')
  )
  const canComplete = userRole === 'manager' && invoice.status === 'approved'
  const canViewScanned = invoice.scanned_invoice_url

  return (
    <div className="space-y-4">
      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Status</CardTitle>
          <CardDescription>Current workflow stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <StatusStep 
              label="Submitted" 
              completed={['submitted', 'awaiting_approval', 'approved', 'processing', 'completed'].includes(invoice.status)}
              active={invoice.status === 'submitted'}
            />
            <StatusStep 
              label="Manager Review" 
              completed={['awaiting_approval', 'approved', 'processing', 'completed'].includes(invoice.status)}
              active={invoice.status === 'awaiting_approval'}
            />
            <StatusStep 
              label="Client Approval" 
              completed={['approved', 'processing', 'completed'].includes(invoice.status)}
              active={invoice.status === 'approved'}
            />
            <StatusStep 
              label="Sent to Client" 
              completed={invoice.status === 'completed'}
              active={invoice.status === 'completed'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Manager Actions - Upload Scanned Invoice */}
      {canUploadScanned && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Scanned Invoice</CardTitle>
            <CardDescription>
              Upload the manually prepared service invoice for client approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please prepare the physical service invoice and upload a scanned copy for the client to review and approve.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="scanned-file">Select File (PDF or Image)</Label>
              <input
                id="scanned-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setScannedFile(e.target.files?.[0] || null)}
                className="mt-2"
              />
            </div>
            <Button
              onClick={uploadScannedInvoice}
              disabled={!scannedFile || loading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {loading ? 'Uploading...' : 'Upload and Send for Approval'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* View/Download Scanned Invoice */}
      {canViewScanned && (
        <Card>
          <CardHeader>
            <CardTitle>Scanned Service Invoice</CardTitle>
            <CardDescription>
              {isOwner ? 'Review the service invoice prepared by your manager' : 'View the uploaded service invoice'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.open(invoice.scanned_invoice_url!, '_blank')}
                className="flex-1"
              >
                <Eye className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
              <Button
                variant="outline"
                onClick={downloadInvoice}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Approval Actions */}
      {canApprove && (
        <Card>
          <CardHeader>
            <CardTitle>Approve Invoice</CardTitle>
            <CardDescription>
              Review and approve the service invoice before it&apos;s sent to the billed client
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                By approving, you confirm that the service invoice is accurate and ready to be sent to the billed client.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="approval-note">Approval Note (Optional)</Label>
              <Textarea
                id="approval-note"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Add any notes about your approval..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => updateInvoiceStatus('approved', approvalNote)}
                disabled={loading}
                className="flex-1"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejection Option */}
      {canReject && (
        <Card>
          <CardHeader>
            <CardTitle>Reject Invoice</CardTitle>
            <CardDescription>
              If there are issues with the invoice, you can reject it with feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please explain why the invoice is being rejected..."
                rows={3}
              />
            </div>
            <Button
              variant="destructive"
              onClick={() => updateInvoiceStatus('rejected', rejectionReason)}
              disabled={loading || !rejectionReason.trim()}
              className="w-full"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject Invoice
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manager Final Action - Send to Client */}
      {canComplete && (
        <Card>
          <CardHeader>
            <CardTitle>Send to Billed Client</CardTitle>
            <CardDescription>
              The invoice has been approved. Send the final invoice to the billed client.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Invoice approved by {invoice.client_name}. Ready to send to the billed client.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => updateInvoiceStatus('completed', 'Invoice sent to billed client')}
              disabled={loading}
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              Mark as Sent to Client
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusStep({ 
  label, 
  completed, 
  active 
}: { 
  label: string
  completed: boolean
  active: boolean 
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center
        ${completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}
        ${active ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}
      `}>
        {completed ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
      </div>
      <span className={`
        text-xs mt-2 text-center
        ${active ? 'font-bold text-blue-600' : ''}
        ${completed ? 'text-green-600' : 'text-gray-500'}
      `}>
        {label}
      </span>
    </div>
  )
}