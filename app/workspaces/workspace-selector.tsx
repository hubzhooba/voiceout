'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { User } from '@supabase/supabase-js'
import { 
  Building2, 
  Plus, 
  Users, 
  FileText, 
  LogOut, 
  ArrowRight,
  Calendar,
  UserCircle,
  Briefcase,
  Shield
} from 'lucide-react'

interface WorkspaceWithRole {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  userRole: string
  primaryRole: string | null
}

interface WorkspaceSelectorProps {
  user: User
  profile: any
  workspaces: WorkspaceWithRole[]
}

export function WorkspaceSelector({ user, profile, workspaces: initialWorkspaces }: WorkspaceSelectorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDescription, setWorkspaceDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const createWorkspace = async () => {
    setLoading(true)
    
    try {
      // Create the workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: workspaceName,
          description: workspaceDescription,
          owner_id: user.id,
        })
        .select()
        .single()

      if (workspaceError) {
        console.error('Workspace creation error:', workspaceError)
        if (workspaceError.message?.includes('duplicate') || workspaceError.message?.includes('unique')) {
          toast({
            title: "Workspace name already exists",
            description: "Please choose a different name for your workspace.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error creating workspace",
            description: workspaceError.message || "Failed to create workspace. Please try again.",
            variant: "destructive",
          })
        }
      } else if (workspace) {
        // Add user as admin member
        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'admin',
          })

        if (memberError) {
          console.error('Member creation error:', memberError)
          toast({
            title: "Warning",
            description: "Workspace created but couldn't add you as member. Please refresh the page.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Success",
            description: "Workspace created successfully!",
          })
          // Navigate to the new workspace
          router.push(`/dashboard?workspace=${workspace.id}`)
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
    
    setLoading(false)
    setShowCreateDialog(false)
    setWorkspaceName('')
    setWorkspaceDescription('')
  }

  const navigateToWorkspace = (workspaceId: string) => {
    router.push(`/dashboard?workspace=${workspaceId}`)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />
      case 'manager':
        return <Briefcase className="h-4 w-4" />
      default:
        return <UserCircle className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'manager':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">VoiceOut Workspaces</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {profile?.full_name || user.email}
              </span>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Your Workspaces</h2>
            <p className="text-muted-foreground">
              Select a workspace to manage invoices or create a new one
            </p>
          </div>

          {/* Workspaces Grid */}
          {workspaces.length === 0 ? (
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle>No Workspaces Yet</CardTitle>
                <CardDescription>
                  Create your first workspace to start managing invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button size="lg">
                      <Plus className="mr-2 h-5 w-5" />
                      Create Your First Workspace
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Workspace</DialogTitle>
                      <DialogDescription>
                        A workspace is where you and your team manage invoices together
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="workspace-name">Workspace Name</Label>
                        <Input
                          id="workspace-name"
                          value={workspaceName}
                          onChange={(e) => setWorkspaceName(e.target.value)}
                          placeholder="My Business"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="workspace-description">Description (Optional)</Label>
                        <Input
                          id="workspace-description"
                          value={workspaceDescription}
                          onChange={(e) => setWorkspaceDescription(e.target.value)}
                          placeholder="Brief description of your workspace"
                        />
                      </div>
                      <Button 
                        onClick={createWorkspace} 
                        disabled={!workspaceName || loading}
                        className="w-full"
                      >
                        {loading ? 'Creating...' : 'Create Workspace'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {workspaces.map((workspace) => (
                  <Card 
                    key={workspace.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigateToWorkspace(workspace.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {workspace.name}
                          </CardTitle>
                          {workspace.description && (
                            <CardDescription className="mt-2">
                              {workspace.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge 
                          variant={getRoleColor(workspace.userRole) as any}
                          className="ml-2"
                        >
                          {getRoleIcon(workspace.userRole)}
                          <span className="ml-1">{workspace.userRole}</span>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {workspace.primaryRole && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <UserCircle className="h-4 w-4 mr-2" />
                            Primary role: {workspace.primaryRole}
                          </div>
                        )}
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2" />
                          Created {new Date(workspace.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="h-4 w-4 mr-2" />
                          {workspace.owner_id === user.id ? 'Owner' : 'Member'}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="w-full mt-4 justify-between"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigateToWorkspace(workspace.id)
                        }}
                      >
                        Enter Workspace
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {/* Add New Workspace Card */}
                <Card 
                  className="border-dashed hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <CardHeader>
                    <CardTitle>Create New Workspace</CardTitle>
                    <CardDescription>
                      Start a new workspace for another business or project
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Plus className="h-12 w-12 text-muted-foreground mb-4" />
                    <Button variant="outline">
                      Add Workspace
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Create Workspace Dialog */}
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Workspace</DialogTitle>
                    <DialogDescription>
                      A workspace is where you and your team manage invoices together
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="workspace-name">Workspace Name</Label>
                      <Input
                        id="workspace-name"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="My Business"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workspace-description">Description (Optional)</Label>
                      <Input
                        id="workspace-description"
                        value={workspaceDescription}
                        onChange={(e) => setWorkspaceDescription(e.target.value)}
                        placeholder="Brief description of your workspace"
                      />
                    </div>
                    <Button 
                      onClick={createWorkspace} 
                      disabled={!workspaceName || loading}
                      className="w-full"
                    >
                      {loading ? 'Creating...' : 'Create Workspace'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  )
}