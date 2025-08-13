'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Download, Check, X, Upload, Eye } from 'lucide-react'
import { Database } from '@/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']

interface InvoiceDetailProps {
  invoice: Invoice
  userRole: 'user' | 'manager' | 'admin'
  onUpdate: () => void
  onClose: () => void
}

export function InvoiceDetail({ invoice, userRole, onUpdate, onClose }: InvoiceDetailProps) {
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [processingNote, setProcessingNote] = useState('')
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchInvoiceItems()
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

  const updateInvoiceStatus = async (newStatus: Invoice['status'], note?: string) => {
    setLoading(true)

    const updates: Record<string, string> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (note) {
      updates.processing_notes = note
    }

    if (newStatus === 'processing') {
      updates.processed_at = new Date().toISOString()
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
        description: `Invoice ${newStatus}`,
      })
      
      if ((newStatus === 'processing' || newStatus === 'completed' || newStatus === 'rejected') && invoice.submitted_by) {
        await createNotification(invoice.submitted_by, newStatus)
      }
      
      onUpdate()
    }

    setLoading(false)
  }

  const createNotification = async (userId: string, status: string) => {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'invoice_status',
        title: `Invoice ${invoice.invoice_number} ${status}`,
        message: `Your invoice has been ${status}`,
        related_id: invoice.id,
      })
  }

  const uploadScannedInvoice = async () => {
    if (!scannedFile) return

    setUploadingFile(true)

    const fileExt = scannedFile.name.split('.').pop()
    const fileName = `${invoice.id}-${Date.now()}.${fileExt}`
    const filePath = `invoices/${invoice.workspace_id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, scannedFile)

    if (uploadError) {
      if (uploadError.message.includes('bucket')) {
        const { error: bucketError } = await supabase.storage.createBucket('documents', {
          public: false,
          fileSizeLimit: 10485760
        })
        
        if (!bucketError || bucketError.message.includes('already exists')) {
          const { error: retryError } = await supabase.storage
            .from('documents')
            .upload(filePath, scannedFile)
          
          if (retryError) {
            toast({
              title: "Error",
              description: "Failed to upload file",
              variant: "destructive",
            })
            setUploadingFile(false)
            return
          }
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to upload file",
          variant: "destructive",
        })
        setUploadingFile(false)
        return
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ scanned_invoice_url: publicUrl })
      .eq('id', invoice.id)

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Scanned invoice uploaded",
      })
      onUpdate()
    }

    setUploadingFile(false)
    setScannedFile(null)
  }

  const downloadInvoice = () => {
    const invoiceData = {
      invoice_number: invoice.invoice_number,
      client: {
        name: invoice.client_name,
        email: invoice.client_email,
        phone: invoice.client_phone,
        address: invoice.client_address,
      },
      service_date: invoice.service_date,
      items: items,
      subtotal: invoice.amount,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      notes: invoice.notes,
    }

    const dataStr = JSON.stringify(invoiceData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `invoice-${invoice.invoice_number}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'submitted': return 'default'
      case 'processing': return 'outline'
      case 'completed': return 'default'
      case 'rejected': return 'destructive'
      default: return 'secondary'
    }
  }

  const canProcess = userRole !== 'user' && invoice.status === 'submitted'
  const canUpload = userRole !== 'user'

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice {invoice.invoice_number}</span>
            <Badge variant={getStatusColor(invoice.status)}>
              {invoice.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Created on {format(new Date(invoice.created_at), 'MMM dd, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <p className="font-medium">{invoice.client_name}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="font-medium">{invoice.client_email}</p>
              </div>
              <div>
                <Label>Phone</Label>
                <p className="font-medium">{invoice.client_phone || 'Not provided'}</p>
              </div>
              <div>
                <Label>Address</Label>
                <p className="font-medium">{invoice.client_address || 'Not provided'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Service Date</Label>
                <p className="font-medium">
                  {format(new Date(invoice.service_date), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <Label>Description</Label>
                <p className="font-medium">{invoice.service_description}</p>
              </div>
              {invoice.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="font-medium">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × ${item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-medium">${item.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${invoice.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${invoice.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.scanned_invoice_url && (
            <Card>
              <CardHeader>
                <CardTitle>Scanned Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => window.open(invoice.scanned_invoice_url!, '_blank')}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Scanned Document
                </Button>
              </CardContent>
            </Card>
          )}

          {canUpload && !invoice.scanned_invoice_url && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Scanned Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setScannedFile(e.target.files?.[0] || null)}
                />
                <Button
                  onClick={uploadScannedInvoice}
                  disabled={!scannedFile || uploadingFile}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingFile ? 'Uploading...' : 'Upload Document'}
                </Button>
              </CardContent>
            </Card>
          )}

          {canProcess && (
            <Card>
              <CardHeader>
                <CardTitle>Process Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Processing Note (Optional)</Label>
                  <Textarea
                    value={processingNote}
                    onChange={(e) => setProcessingNote(e.target.value)}
                    rows={3}
                    placeholder="Add any notes about this invoice..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateInvoiceStatus('processing', processingNote)}
                    disabled={loading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Start Processing
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateInvoiceStatus('rejected', processingNote)}
                    disabled={loading}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {invoice.status === 'processing' && userRole !== 'user' && (
            <Card>
              <CardHeader>
                <CardTitle>Complete Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => updateInvoiceStatus('completed')}
                  disabled={loading}
                  className="w-full"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark as Completed
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={downloadInvoice}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}