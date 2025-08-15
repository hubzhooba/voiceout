'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Tent, 
  FileText, 
  LogIn,
  Copy,
  ExternalLink,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { CreateTentDialog } from '@/components/tents/create-tent-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TentMember {
  user_id: string
  tent_role: string
  is_admin: boolean
  profiles: {
    id: string
    full_name: string
    email: string
  }
}

interface Tent {
  id: string
  name: string
  description: string
  invite_code: string
  is_locked: boolean
  created_at: string
  creator_role: string
  tent_members: TentMember[]
}

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  amount: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  tent_id: string
}

interface DashboardStats {
  totalTents: number
  totalInvoices: number
  pendingInvoices: number
  approvedInvoices: number
  totalRevenue: number
}

export function DashboardView({ userId }: { userId: string }) {
  const [tents, setTents] = useState<Tent[]>([])
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalTents: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    approvedInvoices: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchDashboardData()
    
    // Set up real-time subscription for tent changes
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tent_members',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // Refresh dashboard when tent membership changes
          fetchDashboardData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        () => {
          // Refresh dashboard when invoices change
          fetchDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchDashboardData = async () => {
    try {
      // Fetch user's tents
      const { data: memberData, error: memberError } = await supabase
        .from('tent_members')
        .select('tent_id')
        .eq('user_id', userId)

      if (memberError) throw memberError

      const tentIds = memberData?.map(m => m.tent_id) || []
      
      if (tentIds.length > 0) {
        // Fetch tent details
        const { data: tentsData, error: tentsError } = await supabase
          .from('tents')
          .select('*')
          .in('id', tentIds)
          .order('created_at', { ascending: false })
          .limit(5)

        if (tentsError) throw tentsError
        
        // Fetch members for each tent
        const tentsWithMembers = await Promise.all(
          (tentsData || []).map(async (tent) => {
            const { data: members } = await supabase
              .from('tent_members')
              .select(`
                user_id,
                tent_role,
                is_admin,
                profiles (
                  id,
                  full_name,
                  email
                )
              `)
              .eq('tent_id', tent.id)
            
            return {
              ...tent,
              tent_members: members || []
            }
          })
        )
        
        setTents(tentsWithMembers)

        // Fetch recent invoices from user's tents
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select('*')
          .in('tent_id', tentIds)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!invoicesError && invoicesData) {
          setRecentInvoices(invoicesData)
          
          // Calculate stats with null safety
          const approved = invoicesData.filter(inv => inv.status === 'approved')
          const pending = invoicesData.filter(inv => inv.status === 'submitted')
          const totalRevenue = approved.reduce((sum, inv) => sum + (Number(inv.total_amount) || Number(inv.amount) || 0), 0)
          
          setStats({
            totalTents: tentIds.length,
            totalInvoices: invoicesData.length,
            pendingInvoices: pending.length,
            approvedInvoices: approved.length,
            totalRevenue
          })
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinTent = async () => {
    if (!joinCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a tent invite code',
        variant: 'destructive'
      })
      return
    }

    setJoining(true)
    
    try {
      const response = await fetch('/api/tents/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode.toUpperCase() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join tent')
      }

      toast({
        title: 'Success!',
        description: `You've joined ${data.tent.name}`,
      })
      
      setShowJoinDialog(false)
      setJoinCode('')
      fetchDashboardData()
      router.push(`/tents/${data.tent.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join tent',
        variant: 'destructive'
      })
    } finally {
      setJoining(false)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({
      title: 'Copied!',
      description: 'Invite code copied to clipboard',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
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

  const getUserRole = (tent: Tent) => {
    const member = tent.tent_members?.find(m => m.user_id === userId)
    return member?.tent_role || 'member'
  }

  const isAdmin = (tent: Tent) => {
    const member = tent.tent_members?.find(m => m.user_id === userId)
    return member?.is_admin || false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tents and invoices
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <LogIn className="mr-2 h-4 w-4" />
                Join Tent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a Tent</DialogTitle>
                <DialogDescription>
                  Enter the invite code to join an existing tent
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-code">Invite Code</Label>
                  <Input
                    id="invite-code"
                    placeholder="Enter 6-character code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleJoinTent}
                  disabled={joining || joinCode.length !== 6}
                >
                  {joining ? 'Joining...' : 'Join Tent'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <CreateTentDialog onTentCreated={fetchDashboardData} />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tents</CardTitle>
            <Tent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="tents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tents">My Tents</TabsTrigger>
          <TabsTrigger value="invoices">Recent Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="tents" className="space-y-4">
          {tents.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Tents Yet</CardTitle>
                <CardDescription>
                  Create your first tent or join an existing one to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <CreateTentDialog onTentCreated={fetchDashboardData} />
                <Button
                  variant="outline"
                  onClick={() => setShowJoinDialog(true)}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Join Tent
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tents.map((tent) => (
                <Card key={tent.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{tent.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {tent.description || 'No description'}
                        </CardDescription>
                      </div>
                      {isAdmin(tent) && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium">
                        {tent.tent_members?.length || 0}/2
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Your Role</span>
                      <span className="font-medium capitalize">
                        {getUserRole(tent)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">
                        {tent.is_locked ? '🔒 Locked' : '🔓 Open'}
                      </span>
                    </div>
                    {!tent.is_locked && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {tent.invite_code}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyInviteCode(tent.invite_code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/tents/${tent.id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Enter Tent
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {recentInvoices.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Invoices Yet</CardTitle>
                <CardDescription>
                  Invoices will appear here once you start creating them in your tents
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
                <CardDescription>
                  Your latest invoice activity across all tents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/tents/${invoice.tent_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(invoice.status)}
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {invoice.client_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${invoice.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}