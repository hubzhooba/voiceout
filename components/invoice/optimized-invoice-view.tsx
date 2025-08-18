'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { OptimizedButton as Button } from '@/components/ui/optimized-button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useOptimizedNavigation } from '@/hooks/use-optimized-navigation'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Edit,
  Trash,
  Printer,
  Check
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
  tent_id: string
}

interface OptimizedInvoiceViewProps {
  invoiceId: string
  initialInvoice?: Invoice
  tentName?: string
  userRole: 'client' | 'manager'
  isAdmin: boolean
  userId: string
}

export function OptimizedInvoiceView({ 
  invoiceId,
  initialInvoice,
  tentName,
  userRole, 
  isAdmin, 
  userId 
}: OptimizedInvoiceViewProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice || null)
  const [loading, setLoading] = useState(!initialInvoice)
  const [processing, setProcessing] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const { navigate } = useOptimizedNavigation()
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (!initialInvoice) {
      fetchInvoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (*)
        `)
        .eq('id', invoiceId)
        .single()

      if (error) throw error
      setInvoice(data)
    } catch (error) {
      console.error('Error fetching invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to load invoice',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const canEdit = invoice && 
    invoice.status === 'draft' && 
    (invoice.submitted_by === userId || isAdmin)

  const canDelete = invoice &&
    invoice.status === 'draft' && 
    invoice.submitted_by === userId

  const canApprove = invoice &&
    invoice.status === 'submitted' && 
    (userRole === 'manager' || isAdmin)

  const handleApprove = async () => {
    if (!invoice) return
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
      
      navigate(`/tents/${invoice.tent_id}`)
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
    if (!invoice || !rejectionReason.trim()) {
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
      navigate(`/tents/${invoice.tent_id}`)
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
    if (!invoice || !confirm('Are you sure you want to delete this invoice?')) return

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
      
      navigate(`/tents/${invoice.tent_id}`)
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

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusIcon = () => {
    if (!invoice) return null
    switch (invoice.status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'submitted':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    if (!invoice) return 'outline'
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

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="bg-white rounded-lg p-8 space-y-6">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Invoice not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Action Bar - Not printed */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/tents/${invoice.tent_id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Invoice #{invoice.invoice_number}</h1>
            {tentName && (
              <p className="text-sm text-gray-600">{tentName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
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
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Invoice Template - Clean format for printing */}
      <div className="bg-white rounded-lg shadow-sm p-8 print:shadow-none">
        {/* Status Badge */}
        <div className="flex justify-between items-start mb-6 print:hidden">
          <Badge variant={getStatusColor() as 'default' | 'destructive' | 'secondary' | 'outline'} className="flex items-center gap-1">
            {getStatusIcon()}
            <span className="capitalize">{invoice.status}</span>
          </Badge>
          {invoice.rejection_reason && (
            <div className="text-sm text-red-600 max-w-sm text-right">
              <span className="font-medium">Rejected:</span> {invoice.rejection_reason}
            </div>
          )}
        </div>

        {/* Invoice Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">INVOICE</h2>
          <p className="text-sm text-gray-600 mt-1">Service Invoice</p>
        </div>

        {/* Invoice Info */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2">
              <div className={`w-5 h-5 border-2 border-gray-400 rounded flex items-center justify-center ${invoice.is_cash_sale ? 'bg-gray-100' : ''}`}>
                {invoice.is_cash_sale && <Check className="w-3 h-3" />}
              </div>
              <span className="text-sm font-medium">CASH SALE</span>
            </label>
            <label className="flex items-center gap-2">
              <div className={`w-5 h-5 border-2 border-gray-400 rounded flex items-center justify-center ${!invoice.is_cash_sale ? 'bg-gray-100' : ''}`}>
                {!invoice.is_cash_sale && <Check className="w-3 h-3" />}
              </div>
              <span className="text-sm font-medium">CHARGE SALE</span>
            </label>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">Invoice Number</p>
              <p className="font-bold text-lg">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Invoice Date</p>
              <p className="font-medium">{format(new Date(invoice.created_at), 'MMM dd, yyyy')}</p>
              {invoice.service_date && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Service Date</p>
                  <p className="font-medium">{format(new Date(invoice.service_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bill To Section - Now appears after invoice date */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-bold text-gray-700 mb-3">BILL TO:</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-gray-900 text-lg">{invoice.client_name}</p>
              {invoice.client_tin && (
                <p className="text-sm text-gray-600 mt-1">TIN: {invoice.client_tin}</p>
              )}
            </div>
            <div className="space-y-1">
              {invoice.client_email && (
                <p className="text-sm text-gray-600">{invoice.client_email}</p>
              )}
              {invoice.client_address && (
                <p className="text-sm text-gray-600">{invoice.client_address}</p>
              )}
              {invoice.client_phone && (
                <p className="text-sm text-gray-600">Tel: {invoice.client_phone}</p>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Items Table */}
        <div className="mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 text-sm font-bold text-gray-700">DESCRIPTION</th>
                <th className="text-center py-3 text-sm font-bold text-gray-700 w-20">QTY</th>
                <th className="text-right py-3 text-sm font-bold text-gray-700 w-28">UNIT PRICE</th>
                <th className="text-right py-3 text-sm font-bold text-gray-700 w-28">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_items?.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-3 text-sm">{item.description}</td>
                  <td className="py-3 text-sm text-center">{item.quantity}</td>
                  <td className="py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                </tr>
              )) || (
                <tr className="border-b border-gray-200">
                  <td className="py-3 text-sm">{invoice.service_description || 'Service'}</td>
                  <td className="py-3 text-sm text-center">1</td>
                  <td className="py-3 text-sm text-right">{formatCurrency(invoice.amount)}</td>
                  <td className="py-3 text-sm text-right font-medium">{formatCurrency(invoice.amount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.amount)}</span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            {invoice.withholding_tax > 0 && (
              <div className="flex justify-between text-sm">
                <span>Withholding Tax ({invoice.withholding_tax_percent}%)</span>
                <span className="font-medium text-red-600">-{formatCurrency(invoice.withholding_tax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total Due</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2">Notes:</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}

        {/* Approval Actions - Not printed */}
        {canApprove && (
          <div className="flex gap-2 mt-8 pt-6 border-t print:hidden">
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
      </div>

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