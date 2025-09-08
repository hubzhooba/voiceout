'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency as formatPHP } from '@/lib/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Edit,
  Trash
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_tin?: string
  client_email?: string
  client_phone?: string
  client_address?: string
  is_cash_sale: boolean
  service_description?: string
  service_date?: string
  amount: number
  tax_amount: number
  withholding_tax: number
  withholding_tax_percent: number
  total_amount: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  notes?: string
  submitted_by?: string
  submitted_at?: string
  approved_by?: string
  approved_at?: string
  rejected_by?: string
  rejected_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
  invoice_items: InvoiceItem[]
  profiles?: { full_name: string; email: string }
  approved_profile?: { full_name: string; email: string }
  rejected_profile?: { full_name: string; email: string }
  tent_id: string
}

interface InvoiceDetailViewProps {
  invoice: Invoice
  tent: { name: string; description?: string } | null
  userRole: 'client' | 'manager'
  isAdmin: boolean
  userId: string
}

export function InvoiceDetailView({ 
  invoice, 
  tent, 
  userRole, 
  isAdmin, 
  userId 
}: InvoiceDetailViewProps) {
  const [processing, setProcessing] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const canEdit = 
    invoice.status === 'draft' && 
    (invoice.submitted_by === userId || isAdmin)

  const canDelete = 
    invoice.status === 'draft' && 
    invoice.submitted_by === userId

  const canApprove = 
    invoice.status === 'submitted' && 
    (userRole === 'manager' || isAdmin)

  const handleApprove = async () => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString()
        })
        .eq('id', invoice.id)

      if (error) throw error

      toast({
        title: 'Invoice Approved',
        description: 'The invoice has been approved successfully.',
      })
      
      // Navigate back to tent view with refresh
      router.push(`/tents/${invoice.tent_id}`)
      router.refresh()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to approve invoice',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      })
      return
    }

    setProcessing(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'rejected',
          rejected_by: userId,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', invoice.id)

      if (error) throw error

      toast({
        title: 'Invoice Rejected',
        description: 'The invoice has been rejected.',
      })
      
      setShowRejectDialog(false)
      // Navigate back to tent view with refresh
      router.push(`/tents/${invoice.tent_id}`)
      router.refresh()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to reject invoice',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice?')) return

    setProcessing(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)

      if (error) throw error

      toast({
        title: 'Invoice Deleted',
        description: 'The invoice has been deleted successfully.',
      })
      
      router.push(`/tents/${invoice.tent_id}`)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete invoice',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = () => {
    switch (invoice.status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'submitted':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (invoice.status) {
      case 'approved':
        return 'default'
      case 'rejected':
        return 'destructive'
      case 'submitted':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const formatCurrency = (amount: number) => {
    return formatPHP(amount)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Invoice Details</h1>
            {tent && (
              <p className="text-sm text-muted-foreground">
                {tent.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={processing}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Invoice Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <CardTitle>{invoice.invoice_number}</CardTitle>
            </div>
            <Badge variant={getStatusColor() as 'default' | 'destructive' | 'secondary' | 'outline'} className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="capitalize">{invoice.status}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {new Date(invoice.created_at).toLocaleDateString()}
              </p>
            </div>
            {invoice.submitted_at && (
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {new Date(invoice.submitted_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {invoice.approved_at && (
              <div>
                <p className="text-muted-foreground">Approved</p>
                <p className="font-medium">
                  {new Date(invoice.approved_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {invoice.rejected_at && (
              <div>
                <p className="text-muted-foreground">Rejected</p>
                <p className="font-medium">
                  {new Date(invoice.rejected_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {invoice.rejection_reason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm font-medium text-red-900">Rejection Reason:</p>
              <p className="text-sm text-red-700 mt-1">{invoice.rejection_reason}</p>
            </div>
          )}

          {canApprove && (
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Invoice
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={processing}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Client Name</Label>
              <p className="font-medium">{invoice.client_name}</p>
            </div>
            {invoice.client_tin && (
              <div>
                <Label>TIN</Label>
                <p className="font-medium">{invoice.client_tin}</p>
              </div>
            )}
            {invoice.client_email && (
              <div>
                <Label>Email</Label>
                <p className="font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {invoice.client_email}
                </p>
              </div>
            )}
            {invoice.client_phone && (
              <div>
                <Label>Phone</Label>
                <p className="font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {invoice.client_phone}
                </p>
              </div>
            )}
            {invoice.client_address && (
              <div className="md:col-span-2">
                <Label>Address</Label>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {invoice.client_address}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invoice.invoice_items?.map((item) => (
              <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <p className="font-medium">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <p>Subtotal</p>
              <p className="font-medium">{formatCurrency(invoice.amount)}</p>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between">
                <p>Tax</p>
                <p className="font-medium">{formatCurrency(invoice.tax_amount)}</p>
              </div>
            )}
            {invoice.withholding_tax > 0 && (
              <div className="flex justify-between">
                <p>Withholding Tax ({invoice.withholding_tax_percent}%)</p>
                <p className="font-medium">-{formatCurrency(invoice.withholding_tax)}</p>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <p>Total</p>
              <p>{formatCurrency(invoice.total_amount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      {(invoice.service_description || invoice.notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.service_description && (
              <div>
                <Label>Service Description</Label>
                <p className="mt-1">{invoice.service_description}</p>
              </div>
            )}
            {invoice.service_date && (
              <div>
                <Label>Service Date</Label>
                <p className="mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(invoice.service_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <Label>Notes</Label>
                <p className="mt-1">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}