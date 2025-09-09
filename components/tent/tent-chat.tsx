'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { Send, MessageCircle, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Message {
  id: string
  tent_id: string
  sender_id: string
  message: string
  is_edited: boolean
  edited_at: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface TentChatProps {
  tentId: string
  currentUserId: string
  tentMembers: Array<{
    user_id: string
    tent_role: string
    profiles?: {
      full_name: string | null
      email: string
    }
  }>
}

export function TentChat({ tentId, currentUserId, tentMembers }: TentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { toast } = useToast()

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('tent_messages')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .eq('tent_id', tentId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`tent-chat:${tentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tent_messages',
          filter: `tent_id=eq.${tentId}`
        },
        async (payload) => {
          // Fetch the new message with profile data
          const { data } = await supabase
            .from('tent_messages')
            .select(`
              *,
              profiles (
                full_name,
                email
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages(prev => [...prev, data])
            scrollToBottom()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId])

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('tent_messages')
        .insert({
          tent_id: tentId,
          sender_id: currentUserId,
          message: newMessage.trim()
        })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      })
    } finally {
      setSending(false)
    }
  }

  // Get member info
  const getMemberInfo = (userId: string) => {
    const member = tentMembers.find(m => m.user_id === userId)
    return member?.profiles || null
  }

  // Get member role
  const getMemberRole = (userId: string) => {
    const member = tentMembers.find(m => m.user_id === userId)
    return member?.tent_role || 'member'
  }

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  if (loading) {
    return (
      <div className="glass-card p-6 h-[500px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="glass-card p-0 h-[500px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/20 bg-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary-600 hover-icon" />
          <h3 className="font-semibold">Tent Chat</h3>
          <span className="text-sm text-gray-600 ml-auto">
            {tentMembers.length} members
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50 hover-icon" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isOwn = message.sender_id === currentUserId
                const profile = getMemberInfo(message.sender_id)
                const role = getMemberRole(message.sender_id)

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={`text-xs ${role === 'manager' ? 'bg-primary-100' : 'bg-gray-100'}`}>
                        {profile ? getInitials(profile.full_name, profile.email) : <User className="h-4 w-4 hover-icon" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className={`flex flex-col gap-1 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-medium">
                          {profile?.full_name || profile?.email || 'Unknown'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs hover-badge ${
                          role === 'manager' 
                            ? 'bg-primary-100 text-primary-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {role}
                        </span>
                        <span className="text-gray-500">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                        {message.is_edited && (
                          <span className="text-gray-400 italic">(edited)</span>
                        )}
                      </div>

                      <div className={`px-4 py-2 rounded-2xl ${
                        isOwn 
                          ? 'bg-gradient-primary text-white' 
                          : 'bg-white/60 text-gray-800'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-white/20 bg-white/10">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="input-glass flex-1"
            disabled={sending}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="btn-primary hover-button-subtle"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Send className="h-4 w-4 hover-icon" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}