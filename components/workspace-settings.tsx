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
import { Settings, Trash2, Save } from 'lucide-react'
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
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const canEditSettings = userRole === 'admin'

  const updateWorkspace = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('workspaces')
      .update({
        name,
        description,
        updated_at: new Date().toISOString(),
      })
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
              disabled={!canEditSettings}
              rows={3}
            />
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
          {canEditSettings && (
            <Button 
              onClick={updateWorkspace} 
              disabled={loading || !name}
              className="w-full sm:w-auto"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Settings</CardTitle>
          <CardDescription>
            Configure invoice defaults and numbering
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-prefix">Invoice Number Prefix</Label>
            <Input
              id="invoice-prefix"
              placeholder="INV-"
              disabled={!canEditSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              placeholder="10"
              disabled={!canEditSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              placeholder="USD"
              disabled={!canEditSettings}
            />
          </div>
          {canEditSettings && (
            <Button 
              variant="outline"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <Settings className="mr-2 h-4 w-4" />
              Save Invoice Settings
            </Button>
          )}
        </CardContent>
      </Card>

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