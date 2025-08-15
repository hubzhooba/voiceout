'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  Send, 
  ArrowLeft, 
  Users, 
  Lock, 
  Copy, 
  MessageSquare,
  FileText,
  Plus
} from 'lucide-react'
import { format } from 'date-fns'

interface RoomParticipant {
  user_id: string
  role: string
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
  workspace_id: string
  room_participants: RoomParticipant[]
}

interface Message {
  id: string
  room_id: string
  user_id: string
  message: string
  created_at: string
  profiles?: {
    email: string
    full_name: string | null
  }
}

interface CollaborationRoomViewProps {
  room: CollaborationRoom
  currentUserId: string
}

interface SharedInvoice {
  id: string
  room_id: string
  invoice_id: string
  shared_by: string
  shared_at: string
  invoices?: {
    id: string
    invoice_number: string
    client_name: string
    total_amount: number
    status: string
    created_at: string
  }
  profiles?: {
    email: string
    full_name: string | null
  }
}

export function CollaborationRoomView({ room, currentUserId }: CollaborationRoomViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sharedInvoices, setSharedInvoices] = useState<SharedInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  // const isCreator = room.created_by === currentUserId
  // const otherParticipant = room.room_participants.find(p => p.user_id !== currentUserId)
  // const currentParticipant = room.room_participants.find(p => p.user_id === currentUserId)

  useEffect(() => {
    fetchMessages()
    fetchSharedInvoices()
    
    // Set up real-time subscription for messages
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('room_messages')
      .select(`
        *,
        profiles (
          email,
          full_name
        )
      `)
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
    }
  }

  const fetchSharedInvoices = async () => {
    const { data } = await supabase
      .from('room_invoices')
      .select(`
        *,
        invoices (
          id,
          invoice_number,
          client_name,
          total_amount,
          status,
          created_at
        ),
        profiles:shared_by (
          email,
          full_name
        )
      `)
      .eq('room_id', room.id)
      .order('shared_at', { ascending: false })

    if (data) {
      setSharedInvoices(data)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    setLoading(true)
    const { error } = await supabase
      .from('room_messages')
      .insert({
        room_id: room.id,
        user_id: currentUserId,
        message: newMessage.trim()
      })

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      })
    } else {
      setNewMessage('')
    }
    setLoading(false)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const getUserInitials = (participant: RoomParticipant) => {
    if (participant.profiles.full_name) {
      return participant.profiles.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
    }
    return participant.profiles.email[0].toUpperCase()
  }

  const getUserName = (participant: RoomParticipant) => {
    return participant.profiles.full_name || participant.profiles.email
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
                Locked
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Invite Code: {room.invite_code}
                </Badge>
                <Button size="icon" variant="ghost" onClick={copyInviteCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Participants */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participants ({room.room_participants.length}/2)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {room.room_participants.map((participant) => (
                <div key={participant.user_id} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getUserInitials(participant)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{getUserName(participant)}</p>
                    <p className="text-sm text-muted-foreground">
                      {participant.role === 'creator' ? 'Room Creator' : 'Participant'}
                      {participant.user_id === currentUserId && ' (You)'}
                    </p>
                  </div>
                </div>
              ))}
              {room.room_participants.length === 1 && (
                <div className="flex items-center gap-3 opacity-50">
                  <Avatar>
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">Waiting for participant...</p>
                    <p className="text-sm text-muted-foreground">Share the invite code</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <FileText className="mr-2 h-4 w-4" />
              Shared Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <Card className="h-[500px] flex flex-col">
              <CardHeader>
                <CardTitle>Collaboration Chat</CardTitle>
                <CardDescription>
                  Discuss invoices and collaborate in real-time
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 pr-4 mb-4">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No messages yet. Start the conversation!
                      </p>
                    ) : (
                      messages.map((message) => {
                        const isOwn = message.user_id === currentUserId
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {!isOwn && (
                                <p className="text-xs font-medium mb-1">
                                  {message.profiles?.full_name || message.profiles?.email}
                                </p>
                              )}
                              <p className="text-sm">{message.message}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {format(new Date(message.created_at), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    disabled={loading}
                  />
                  <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Shared Invoices</CardTitle>
                    <CardDescription>
                      Invoices shared in this collaboration room
                    </CardDescription>
                  </div>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Share Invoice
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sharedInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No invoices shared yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sharedInvoices.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      >
                        <div>
                          <p className="font-medium">
                            Invoice #{item.invoices?.invoice_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.invoices?.client_name} • ${item.invoices?.total_amount}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Shared by {item.profiles?.full_name || item.profiles?.email} •{' '}
                            {format(new Date(item.shared_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge>{item.invoices?.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}