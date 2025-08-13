'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Upload,
  FileSignature,
  Edit3
} from 'lucide-react'
import { Database } from '@/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

interface ManagerInvoiceActionsProps {
  invoice: Invoice
  onUpdate: () => void
}

export function ManagerInvoiceActions({ 
  invoice, 
  onUpdate 
}: ManagerInvoiceActionsProps) {
  const [loading, setLoading] = useState(false)
  const [managerName, setManagerName] = useState('')
  const [revisionNotes, setRevisionNotes] = useState('')
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const approveWithSignature = async () => {
    if (!managerName.trim()) {
      toast({
        title: "Signature Required",
        description: "Please enter your name as digital signature",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'awaiting_approval',
        prepared_by_name: managerName,
        prepared_by_date: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        processed_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', invoice.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to approve invoice",
        variant: "destructive",
      })
    } else {
      // Log activity
      await supabase
        .from('invoice_activity')
        .insert({
          invoice_id: invoice.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: `Invoice approved and signed by ${managerName}`,
          details: { prepared_by: managerName }
        })

      toast({
        title: "Success",
        description: "Invoice approved and ready for client review",
      })
      
      // Notify client
      if (invoice.submitted_by) {
        await supabase
          .from('notifications')
          .insert({
            user_id: invoice.submitted_by,
            type: 'invoice_status',
            title: `Invoice ${invoice.invoice_number} Ready for Review`,
            message: `Your invoice has been prepared by ${managerName} and is ready for your approval`,
            related_id: invoice.id,
          })
      }
      
      onUpdate()
    }

    setLoading(false)
  }

  const requestRevisions = async () => {
    if (!revisionNotes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide revision notes for the client",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'rejected',
        processing_notes: revisionNotes,
        processed_at: new Date().toISOString(),
        processed_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', invoice.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to request revisions",
        variant: "destructive",
      })
    } else {
      // Log activity
      await supabase
        .from('invoice_activity')
        .insert({
          invoice_id: invoice.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'Revisions requested',
          details: { notes: revisionNotes }
        })

      toast({
        title: "Revisions Requested",
        description: "The client will be notified to make changes",
      })
      
      // Notify client
      if (invoice.submitted_by) {
        await supabase
          .from('notifications')
          .insert({
            user_id: invoice.submitted_by,
            type: 'invoice_status',
            title: `Invoice ${invoice.invoice_number} Needs Revisions`,
            message: revisionNotes,
            related_id: invoice.id,
          })
      }
      
      onUpdate()
    }

    setLoading(false)
  }

  const uploadScannedInvoice = async () => {
    if (!scannedFile) return

    setLoading(true)

    const fileExt = scannedFile.name.split('.').pop()
    const fileName = `${invoice.id}-scanned-${Date.now()}.${fileExt}`
    const filePath = `invoices/${invoice.workspace_id}/${fileName}`

    // Create bucket if needed
    await supabase.storage.createBucket('documents', {
      public: false,
      fileSizeLimit: 10485760
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
    } else {
      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365)

      if (urlData?.signedUrl) {
        await supabase
          .from('invoices')
          .update({ scanned_invoice_url: urlData.signedUrl })
          .eq('id', invoice.id)

        toast({
          title: "Success",
          description: "Scanned invoice uploaded",
        })
        onUpdate()
      }
    }

    setScannedFile(null)
    setLoading(false)
  }

  // Only show actions for submitted invoices
  if (invoice.status !== 'submitted') {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Manager Review Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manager Review</CardTitle>
          <CardDescription>
            Review the invoice and take appropriate action
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display Internal Notes if they exist */}
          {invoice.notes && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Internal Notes from Client:</strong>
                <p className="mt-1">{invoice.notes}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Scanned Invoice */}
          {!invoice.scanned_invoice_url && (
            <div className="space-y-2">
              <Label>Upload Scanned Service Invoice (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setScannedFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  onClick={uploadScannedInvoice}
                  disabled={!scannedFile || loading}
                  variant="outline"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            </div>
          )}

          {/* Approve with Digital Signature */}
          {!showSignature ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowSignature(true)}
                disabled={loading}
                className="flex-1"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve & Sign Invoice
              </Button>
              <Button
                variant="destructive"
                onClick={() => {}}
                disabled={loading}
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Request Revisions
              </Button>
            </div>
          ) : (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="manager-signature">
                  <FileSignature className="inline-block h-4 w-4 mr-2" />
                  Digital Signature (Your Full Name)
                </Label>
                <Input
                  id="manager-signature"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Enter your full name to sign"
                  className="font-semibold"
                />
                <p className="text-xs text-muted-foreground">
                  This will appear as &quot;Prepared By&quot; on the invoice
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={approveWithSignature}
                  disabled={!managerName.trim() || loading}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm & Sign
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSignature(false)
                    setManagerName('')
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Request Revisions Section */}
          <div className="space-y-2">
            <Label htmlFor="revision-notes">
              <Edit3 className="inline-block h-4 w-4 mr-2" />
              Revision Notes (if requesting changes)
            </Label>
            <Textarea
              id="revision-notes"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Describe what needs to be changed..."
              rows={3}
            />
            {revisionNotes.trim() && (
              <Button
                variant="destructive"
                onClick={requestRevisions}
                disabled={loading}
                className="w-full"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Send Revision Request
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}