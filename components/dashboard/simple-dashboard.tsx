'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { CreateTentDialog } from '@/components/tents/create-tent-dialog'
import {
  Tent,
  LogIn,
  Clock,
  CheckCircle,
  Users,
  FileText,
  Calendar,
  ChevronRight
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'

interface SimpleDashboardProps {
  user: { id: string; email: string }
}

export function SimpleDashboard({ user }: SimpleDashboardProps) {
  const [tents, setTents] = useState<{ id: string; name: string; description: string | null; created_at: string; tent_members?: { user_id: string; role: string; profiles: { full_name: string | null; email: string } }[] }[]>([])
  const [recentActivity, setRecentActivity] = useState<{ id: string; invoice_number: string; status: string; total_amount: number; created_at: string; updated_at: string; tent: { id: string; name: string } }[]>([])
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [joiningTent, setJoiningTent] = useState(false)
  
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch user's tents
      const { data: tentsData, error: tentsError } = await supabase
        .from('tent_members')
        .select(`
          tent:tent_id (
            id,
            name,
            description,
            created_at,
            tent_members!tent_id (
              user_id,
              role,
              profiles:user_id (
                full_name,
                email
              )
            )
          )
        `)
        .eq('user_id', user.id)

      if (tentsError) throw tentsError
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tents = tentsData?.map((tm: any) => tm.tent).filter(Boolean) || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTents(tents as any)

      // Fetch recent activity (recent invoices across all tents)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tentIds = tentsData?.map((tm: any) => tm.tent?.id).filter(Boolean) || []
      
      if (tentIds.length > 0) {
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('tent_invoices')
          .select(`
            id,
            invoice_number,
            status,
            total_amount,
            created_at,
            updated_at,
            tent:tent_id (
              id,
              name
            )
          `)
          .in('tent_id', tentIds)
          .order('updated_at', { ascending: false })
          .limit(5)

        if (!invoicesError) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRecentActivity(invoicesData as any || [])
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleJoinTent = async () => {
    if (!joinCode.trim() || joinCode.length !== 8) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a valid 8-character tent code',
        variant: 'destructive'
      })
      return
    }

    setJoiningTent(true)
    try {
      const response = await fetch('/api/tents/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inviteCode: joinCode.toUpperCase(),
          userId: user.id 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to join tent')
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
      setJoiningTent(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3 w-3" />
      case 'approved':
      case 'completed': return <CheckCircle className="h-3 w-3" />
      default: return <FileText className="h-3 w-3" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your tents and invoices</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <CreateTentDialog onTentCreated={fetchDashboardData} />
          <Button
            onClick={() => setShowJoinDialog(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            Join a Tent
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Your Tents Section */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Tent className="h-5 w-5" />
                Your Tents
              </h2>
            </div>
            
            {tents.length === 0 ? (
              <Card className="p-8 text-center">
                <Tent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tents yet</h3>
                <p className="text-gray-600 mb-4">Create your first tent or join an existing one to get started</p>
                <div className="flex gap-3 justify-center">
                  <CreateTentDialog onTentCreated={fetchDashboardData} />
                  <Button
                    onClick={() => setShowJoinDialog(true)}
                    variant="outline"
                    size="sm"
                  >
                    Join a Tent
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tents.map((tent) => (
                  <Card
                    key={tent.id}
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/tents/${tent.id}`)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{tent.name}</h3>
                        {tent.description && (
                          <p className="text-sm text-gray-600 mt-1">{tent.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{tent.tent_members?.length || 0} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDistanceToNow(new Date(tent.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Section */}
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </h2>
            </div>
            
            {recentActivity.length === 0 ? (
              <Card className="p-6 text-center">
                <FileText className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No recent activity</p>
              </Card>
            ) : (
              <Card className="p-4">
                <div className="space-y-3">
                  {recentActivity.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{invoice.invoice_number}</span>
                          <Badge className={`${getStatusColor(invoice.status)} text-xs px-1.5 py-0`}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(invoice.status)}
                              {invoice.status}
                            </span>
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">
                          {invoice.tent?.name} • {formatDistanceToNow(new Date(invoice.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Join Tent Dialog */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join a Tent</DialogTitle>
              <DialogDescription>
                Enter the 8-character invite code to join an existing tent
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter code (e.g., ABCD1234)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="text-center text-2xl font-mono tracking-wider"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleJoinTent} disabled={joiningTent}>
                {joiningTent ? 'Joining...' : 'Join Tent'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}