'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InvoiceForm } from '@/components/invoice-form'
import { InvoiceDetail } from '@/components/invoice-detail'
import { TeamManagement } from '@/components/team-management'
import { WorkspaceSettings } from '@/components/workspace-settings'
import { NotificationsDropdown } from '@/components/notifications-dropdown'
import { CashReceiptBook } from '@/components/cash-receipt-book'
import { WorkspaceRoleSelection } from '@/components/workspace-role-selection'
import { ClientDashboard } from '@/components/client-dashboard'
import { ManagerDashboard } from '@/components/manager-dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { FileText, Plus, Settings, Users, LogOut, Receipt, ToggleLeft, UserCircle, Briefcase, Building2, ChevronDown, Home } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Profile = Database['public']['Tables']['profiles']['Row']
type Workspace = Database['public']['Tables']['workspaces']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']
type Notification = Database['public']['Tables']['notifications']['Row']

interface DashboardContentProps {
  user: User
  profile: Profile | null
  workspaces: Workspace[]
  selectedWorkspaceId?: string
}

export function DashboardContent({ user, profile, workspaces: initialWorkspaces, selectedWorkspaceId }: DashboardContentProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    selectedWorkspaceId 
      ? workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0]
      : workspaces.length > 0 ? workspaces[0] : null
  )
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDescription, setWorkspaceDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'manager' | 'admin'>('user')
  const [viewMode, setViewMode] = useState<'client' | 'manager' | 'admin'>('client')
  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [isNewWorkspace, setIsNewWorkspace] = useState(false)

  useEffect(() => {
    if (selectedWorkspace) {
      fetchInvoices()
      fetchNotifications()
      fetchUserRole()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspace])

  const fetchUserRole = async () => {
    if (!selectedWorkspace) return

    const { data } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', selectedWorkspace.id)
      .eq('user_id', user.id)
      .single()

    if (data) {
      setUserRole(data.role)
    }
  }

  const fetchInvoices = async () => {
    if (!selectedWorkspace) return

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('workspace_id', selectedWorkspace.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      })
    } else {
      setInvoices(data || [])
    }
  }

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!error && data) {
      setNotifications(data)
    }
  }

  const createWorkspace = async () => {
    setLoading(true)
    
    try {
      // Skip duplicate check since it causes 406 errors
      // The database unique constraint will handle duplicates
      
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
        // Check if it's a duplicate name error
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
          // Add the new workspace to the list
          setWorkspaces([...workspaces, workspace])
          setSelectedWorkspace(workspace)
          setShowCreateWorkspace(false)
          setWorkspaceName('')
          setWorkspaceDescription('')
          toast({
            title: "Success",
            description: "Workspace created successfully!",
          })
          // Show role selection for new workspace
          setIsNewWorkspace(true)
          setShowRoleSelection(true)
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
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/workspaces')}
                title="Back to workspaces"
              >
                <Home className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">VoiceOut</h1>
              {selectedWorkspace && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="ml-4">
                        <Building2 className="mr-2 h-4 w-4" />
                        {selectedWorkspace.name}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {workspaces.map((workspace) => (
                        <DropdownMenuItem
                          key={workspace.id}
                          onClick={() => {
                            router.push(`/dashboard?workspace=${workspace.id}`)
                            setSelectedWorkspace(workspace)
                          }}
                          className={workspace.id === selectedWorkspace.id ? 'bg-accent' : ''}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          {workspace.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/workspaces')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Workspace
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/workspaces')}>
                        <Home className="mr-2 h-4 w-4" />
                        All Workspaces
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {userRole === 'admin' && (
                    <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-muted rounded-lg">
                      <UserCircle className="h-4 w-4" />
                      <span className="text-sm">Client View</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode(viewMode === 'client' ? 'manager' : 'client')}
                        className="ml-2"
                      >
                        <ToggleLeft className={`h-4 w-4 transition-transform ${viewMode === 'manager' ? 'rotate-180' : ''}`} />
                      </Button>
                      <Briefcase className="h-4 w-4" />
                      <span className="text-sm">Manager View</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <NotificationsDropdown 
                notifications={notifications} 
                onUpdate={fetchNotifications}
              />
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

      <div className="container mx-auto px-4 py-8">
        {!selectedWorkspace ? (
          <Card>
            <CardHeader>
              <CardTitle>No Workspace Selected</CardTitle>
              <CardDescription>
                Please select or create a workspace to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/workspaces')}>
                Go to Workspaces
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {showRoleSelection && isNewWorkspace && selectedWorkspace && (
              <WorkspaceRoleSelection
                workspace={selectedWorkspace}
                userId={user.id}
                onRoleSelected={(role) => {
                  setViewMode(role === 'admin' ? 'client' : role)
                  if (role !== 'admin') {
                    setUserRole(role === 'manager' ? 'manager' : 'user')
                  }
                }}
                onComplete={() => {
                  setShowRoleSelection(false)
                  setIsNewWorkspace(false)
                }}
              />
            )}
            <Tabs defaultValue="invoices" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="invoices">
                  <FileText className="mr-2 h-4 w-4" />
                  Invoices
                </TabsTrigger>
                <TabsTrigger value="cash-receipts">
                  <Receipt className="mr-2 h-4 w-4" />
                  Cash Receipts
                </TabsTrigger>
                <TabsTrigger value="team">
                  <Users className="mr-2 h-4 w-4" />
                  Team
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="invoices" className="space-y-4">
              {viewMode === 'client' || (viewMode === 'admin' && userRole !== 'manager') ? (
                <ClientDashboard
                  workspace={selectedWorkspace!}
                  invoices={invoices}
                  onInvoiceCreated={fetchInvoices}
                  onInvoiceClick={setSelectedInvoice}
                />
              ) : (
                <ManagerDashboard
                  workspace={selectedWorkspace!}
                  invoices={invoices}
                  onInvoiceClick={setSelectedInvoice}
                />
              )}

            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              {selectedWorkspace && (
                <TeamManagement 
                  workspaceId={selectedWorkspace.id}
                  currentUserId={user.id}
                  userRole={userRole}
                />
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {selectedWorkspace && (
                <WorkspaceSettings 
                  workspace={selectedWorkspace}
                  userRole={userRole}
                  onUpdate={(updated) => {
                    setSelectedWorkspace(updated)
                    setWorkspaces(workspaces.map(w => 
                      w.id === updated.id ? updated : w
                    ))
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="cash-receipts" className="space-y-4">
              {selectedWorkspace && (
                <CashReceiptBook 
                  workspaceId={selectedWorkspace.id}
                  userRole={userRole}
                />
              )}
            </TabsContent>
          </Tabs>
          </>
        )}

        {selectedInvoice && (
          <InvoiceDetail 
            invoice={selectedInvoice}
            userRole={userRole}
            onUpdate={() => {
              fetchInvoices()
              setSelectedInvoice(null)
            }}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </div>
    </div>
  )
}