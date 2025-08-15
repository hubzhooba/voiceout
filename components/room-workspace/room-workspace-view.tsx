'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { InvoiceFormEnhanced } from '@/components/invoice-form-enhanced'
import { InvoiceDetailEnhanced } from '@/components/invoice-detail-enhanced'
import { 
  ArrowLeft, 
  FileText, 
  Settings, 
  MessageSquare,
  Plus,
  Users,
  Lock,
  Copy
} from 'lucide-react'
import { format } from 'date-fns'
import { Database } from '@/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']

interface RoomParticipant {
  user_id: string
  role: string
  workflow_role: string
  profiles: {
    id: string
    email: string
    full_name: string | null
  }
}

interface CollaborationRoom {
  id: string
  name: string
  description: string | null
  invite_code: string
  is_locked: boolean
  created_at: string
  created_by: string
  business_address: string | null
  business_tin: string | null
  default_withholding_tax: number
  invoice_prefix: string | null
  invoice_notes: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>
  room_participants: RoomParticipant[]
}

interface RoomWorkspaceViewProps {
  room: CollaborationRoom
  currentUserId: string
}

export function RoomWorkspaceView({ room, currentUserId }: RoomWorkspaceViewProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const currentParticipant = room.room_participants.find(p => p.user_id === currentUserId)
  // const otherParticipant = room.room_participants.find(p => p.user_id !== currentUserId)
  const userRole = currentParticipant?.workflow_role || 'user'
  const isManager = userRole === 'manager'

  useEffect(() => {
    fetchInvoices()
    
    // Set up real-time subscription for invoices
    const channel = supabase
      .channel(`room-invoices-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchInvoices()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  const fetchInvoices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invoices:', error)
      toast({
        title: 'Error',
        description: 'Failed to load invoices',
        variant: 'destructive',
      })
    } else {
      setInvoices(data || [])
    }
    setLoading(false)
  }

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(room.invite_code)
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy invite code',
        variant: 'destructive',
      })
    }
  }

  const handleInvoiceCreated = () => {
    setShowInvoiceForm(false)
    fetchInvoices()
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'submitted': return 'default'
      case 'approved': return 'default'
      case 'rejected': return 'destructive'
      case 'completed': return 'default'
      default: return 'secondary'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{room.name}</h1>
              {room.description && (
                <p className="text-muted-foreground">{room.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {room.is_locked ? (
              <Badge variant="secondary">
                <Lock className="h-3 w-3 mr-1" />
                Locked (2/2)
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Waiting for participant (1/2)
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {room.invite_code}
                </Badge>
                <Button size="icon" variant="ghost" onClick={copyInviteCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Participants Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Workspace Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {room.room_participants.map((participant) => (
                <div key={participant.user_id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {participant.profiles.full_name || participant.profiles.email}
                      {participant.user_id === currentUserId && ' (You)'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {participant.profiles.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={participant.role === 'creator' ? 'default' : 'secondary'}>
                      {participant.role === 'creator' ? 'Creator' : 'Member'}
                    </Badge>
                    <Badge variant={participant.workflow_role === 'manager' ? 'default' : 'outline'}>
                      {participant.workflow_role === 'manager' ? 'Manager' : 'User'}
                    </Badge>
                  </div>
                </div>
              ))}
              {room.room_participants.length === 1 && (
                <div className="flex items-center justify-between opacity-50">
                  <div>
                    <p className="font-medium">Pending participant...</p>
                    <p className="text-sm text-muted-foreground">Share the invite code above</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Workspace Tabs */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices">
              <FileText className="mr-2 h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Discussion
            </TabsTrigger>
            {isManager && (
              <TabsTrigger value="settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Invoices</h2>
                <p className="text-sm text-muted-foreground">
                  Manage and track invoices in this workspace
                </p>
              </div>
              <Button onClick={() => setShowInvoiceForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </div>

            {showInvoiceForm ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>New Invoice</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowInvoiceForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <InvoiceFormEnhanced
                    workspaceId={room.id} // Pass room ID as workspace ID
                    onSuccess={handleInvoiceCreated}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Invoice List</CardTitle>
                  <CardDescription>
                    {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} in this workspace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No invoices yet</p>
                      <Button
                        className="mt-4"
                        onClick={() => setShowInvoiceForm(true)}
                      >
                        Create First Invoice
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <div>
                            <p className="font-medium">
                              Invoice #{invoice.invoice_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.client_name} • ${invoice.total_amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant={getStatusColor(invoice.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                            {invoice.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Discussion</CardTitle>
                <CardDescription>
                  Collaborate and discuss invoices with your partner
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Chat component would go here - reuse from room-view.tsx */}
                <p className="text-muted-foreground">Chat functionality here...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {isManager && (
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Workspace Settings</CardTitle>
                  <CardDescription>
                    Configure default settings for this workspace
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add workspace settings form here */}
                  <div className="space-y-2">
                    <p className="font-medium">Business Information</p>
                    <p className="text-sm text-muted-foreground">
                      Configure default business details for invoices
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Invoice Detail Modal */}
        {selectedInvoice && (
          <InvoiceDetailEnhanced
            invoice={selectedInvoice}
            userRole={userRole as 'user' | 'manager' | 'admin'}
            currentUserId={currentUserId}
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