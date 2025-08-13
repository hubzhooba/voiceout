'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Trash2, Save } from 'lucide-react'
import { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

interface WorkspaceSettingsProps {
  workspace: Workspace
  userRole: 'user' | 'manager' | 'admin'
  onUpdate: (workspace: Workspace) => void
}

export function WorkspaceSettings({ workspace, userRole, onUpdate }: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [businessAddress, setBusinessAddress] = useState(workspace.business_address || '')
  const [businessTin, setBusinessTin] = useState(workspace.business_tin || '')
  const [defaultWithholdingTax, setDefaultWithholdingTax] = useState(workspace.default_withholding_tax?.toString() || '0')
  const [invoicePrefix, setInvoicePrefix] = useState(workspace.invoice_prefix || '')
  const [invoiceNotes, setInvoiceNotes] = useState(workspace.invoice_notes || '')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const canEditSettings = userRole === 'admin'
  const canEditDescription = userRole === 'admin' || userRole === 'manager'

  const updateWorkspace = async () => {
    setLoading(true)

    // Managers can only update description
    const updateData = userRole === 'manager' 
      ? {
          description,
          updated_at: new Date().toISOString(),
        }
      : {
          name,
          description,
          business_address: businessAddress,
          business_tin: businessTin,
          default_withholding_tax: parseFloat(defaultWithholdingTax) || 0,
          invoice_prefix: invoicePrefix,
          invoice_notes: invoiceNotes,
          updated_at: new Date().toISOString(),
        }

    const { data, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspace.id)
      .select()
      .single()

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update workspace settings",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Workspace settings updated",
      })
      onUpdate(data)
    }

    setLoading(false)
  }

  const deleteWorkspace = async () => {
    setLoading(true)

    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspace.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete workspace",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Workspace deleted successfully",
      })
      router.push('/workspaces')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Manage your workspace information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-description">Description</Label>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEditDescription}
              rows={3}
            />
            {userRole === 'manager' && (
              <p className="text-xs text-muted-foreground">
                As a manager, you can update the workspace description
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Workspace ID</Label>
            <Input value={workspace.id} disabled />
            <p className="text-sm text-muted-foreground">
              This unique identifier is used for API access and integrations
            </p>
          </div>
          <div className="space-y-2">
            <Label>Created</Label>
            <Input 
              value={new Date(workspace.created_at).toLocaleString()} 
              disabled 
            />
          </div>
        </CardContent>
      </Card>

      {canEditSettings && (
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            Default business details for invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-address">Business Address</Label>
            <Textarea
              id="business-address"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              disabled={!canEditSettings}
              placeholder="Enter your business address"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-tin">Business TIN</Label>
            <Input
              id="business-tin"
              value={businessTin}
              onChange={(e) => setBusinessTin(e.target.value)}
              disabled={!canEditSettings}
              placeholder="XXX-XXX-XXX-XXX"
            />
          </div>
        </CardContent>
      </Card>
      )}

      {canEditSettings && (
      <Card>
        <CardHeader>
          <CardTitle>Invoice Settings</CardTitle>
          <CardDescription>
            Default settings for new invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-prefix">Invoice Number Prefix</Label>
            <Input
              id="invoice-prefix"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              disabled={!canEditSettings}
              placeholder="e.g., INV-, 2024-"
            />
            <p className="text-sm text-muted-foreground">
              This prefix will be added to all invoice numbers
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-withholding">Default Withholding Tax (%)</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="default-withholding"
                type="number"
                value={defaultWithholdingTax}
                onChange={(e) => setDefaultWithholdingTax(e.target.value)}
                disabled={!canEditSettings}
                min="0"
                max="100"
                step="0.1"
                className="max-w-32"
              />
              <span className="text-sm font-medium">%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Default withholding tax percentage for new invoices
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Default Invoice Notes</Label>
            <Textarea
              id="invoice-notes"
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              disabled={!canEditSettings}
              placeholder="Notes to include on all invoices..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
      )}

      {canEditDescription && (
        <div className="flex justify-end">
          <Button 
            onClick={updateWorkspace} 
            disabled={loading || (userRole === 'admin' && !name)}
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : userRole === 'manager' ? 'Save Description' : 'Save All Changes'}
          </Button>
        </div>
      )}

      {canEditSettings && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your entire workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the
                    workspace &quot;{workspace.name}&quot; and remove all associated data including
                    invoices, team members, and settings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteWorkspace}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}