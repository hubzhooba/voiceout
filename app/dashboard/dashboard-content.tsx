'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InvoiceDetailEnhanced } from '@/components/invoice-detail-enhanced'
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
import { useToast } from '@/hooks/use-toast'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { FileText, Plus, Settings, Users, LogOut, Receipt, UserCircle, Briefcase, Building2, ChevronDown, Home } from 'lucide-react'
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
  isNewWorkspace?: boolean
}

export function DashboardContent({ user, profile, workspaces: initialWorkspaces, selectedWorkspaceId, isNewWorkspace: isNewWorkspaceProp = false }: DashboardContentProps) {
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [userRole, setUserRole] = useState<'user' | 'manager' | 'admin'>('user')
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewMode, setViewMode] = useState<'client' | 'manager' | 'admin'>('client')
  const [showRoleSelection, setShowRoleSelection] = useState(isNewWorkspaceProp)
  const [isNewWorkspace, setIsNewWorkspace] = useState(isNewWorkspaceProp)

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

    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, primary_role')
      .eq('workspace_id', selectedWorkspace.id)
      .eq('user_id', user.id)
      .single()

    console.log('User role fetch:', { data, error, userId: user.id, workspaceId: selectedWorkspace.id })

    if (data) {
      // Check if user needs to select a role (admin without primary_role)
      if (data.role === 'admin' && !data.primary_role) {
        setShowRoleSelection(true)
        setIsNewWorkspace(true)
      }
      
      // Use primary_role for invoice operations
      const effectiveRole = data.primary_role || (data.role === 'admin' ? 'user' : data.role)
      setUserRole(effectiveRole)
      
      // Track admin status separately for settings access
      setIsAdmin(data.role === 'admin')
      
      console.log('User role set to:', effectiveRole, '(primary:', data.primary_role, 'role:', data.role, ')')
      
      // Set view mode based on primary role
      if (effectiveRole === 'manager') {
        setViewMode('manager')
      } else {
        // Users stay in client view
        setViewMode('client')
      }
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


  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
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
                  {userRole === 'manager' && (
                    <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-muted rounded-lg">
                      <Briefcase className="h-4 w-4" />
                      <span className="text-sm font-medium">Manager View</span>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-muted rounded-lg">
                      <UserCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Workspace Admin</span>
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
              {userRole === 'manager' ? (
                <ManagerDashboard
                  workspace={selectedWorkspace!}
                  invoices={invoices}
                  onInvoiceClick={setSelectedInvoice}
                />
              ) : (
                <ClientDashboard
                  workspace={selectedWorkspace!}
                  invoices={invoices}
                  onInvoiceCreated={fetchInvoices}
                  onInvoiceClick={setSelectedInvoice}
                />
              )}

            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              {selectedWorkspace && (
                <TeamManagement 
                  workspaceId={selectedWorkspace.id}
                  currentUserId={user.id}
                  userRole={isAdmin ? 'admin' : userRole}
                />
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {selectedWorkspace && (
                <WorkspaceSettings 
                  workspace={selectedWorkspace}
                  userRole={isAdmin ? 'admin' : userRole}
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
          <InvoiceDetailEnhanced 
            invoice={selectedInvoice}
            userRole={userRole}
            currentUserId={user.id}
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