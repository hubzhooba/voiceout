'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, isToday, isYesterday } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  MessageSquare,
  Send,
  Hash,
  AtSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  tent_id: string
  user_id: string
  message: string
  metadata?: Record<string, unknown>
  mentioned_users?: string[]
  linked_projects?: string[]
  edited_at?: string | null
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    email: string
  }
}

interface TentMember {
  user_id: string
  tent_role: string
  profiles?: {
    id: string
    full_name: string | null
    email: string
  }
}

interface Project {
  id: string
  project_name: string
  client_name: string
  status: string
}

interface TentChatProps {
  tentId: string
  currentUserId: string
  tentMembers?: TentMember[]
}

export function TentChat({ tentId, currentUserId, tentMembers = [] }: TentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tent_chat_messages')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('tent_id', tentId)
        .order('created_at', { ascending: true })

      if (error) {
        // If table doesn't exist, just return empty
        if (error.code === '42P01') {
          console.log('Chat table not yet created')
          return
        }
        throw error
      }

      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }, [tentId, supabase])

  // Fetch projects for linking
  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_name, status')
        .eq('tent_id', tentId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProjects(data)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }, [tentId, supabase])

  // Set up real-time subscription
  useEffect(() => {
    fetchMessages()
    fetchProjects()

    // Subscribe to new messages
    const channel = supabase
      .channel(`tent-chat-${tentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tent_chat_messages',
          filter: `tent_id=eq.${tentId}`
        },
        async (payload) => {
          // Fetch the full message with profile info
          const { data } = await supabase
            .from('tent_chat_messages')
            .select(`
              *,
              profiles:user_id (
                id,
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tent_chat_messages',
          filter: `tent_id=eq.${tentId}`
        },
        (payload) => {
          setMessages(prev => prev.map(msg => 
            msg.id === payload.new.id 
              ? { ...msg, ...payload.new }
              : msg
          ))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tent_chat_messages',
          filter: `tent_id=eq.${tentId}`
        },
        (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tentId, fetchMessages, fetchProjects, supabase])

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('tent_chat_messages')
        .insert({
          tent_id: tentId,
          user_id: currentUserId,
          message: newMessage.trim()
        })

      if (error) throw error

      setNewMessage('')
      textareaRef.current?.focus()
    } catch (error) {
      console.error('Error sending message:', error)
      
      // If table doesn't exist, show helpful message
      const errorObj = error as { code?: string }
      if (errorObj?.code === '42P01') {
        toast({
          title: 'Chat not available',
          description: 'Please run migration 017_tent_chat_system.sql to enable chat',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to send message',
          variant: 'destructive'
        })
      }
    } finally {
      setSending(false)
    }
  }

  // Handle @ or # input
  const handleMessageInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNewMessage(value)

    // Check for @ to show mentions
    const lastChar = value[value.length - 1]
    const lastWord = value.split(' ').pop() || ''
    
    if (lastChar === '@' || (lastWord.startsWith('@') && lastWord.length > 1)) {
      setShowMentions(true)
      setMentionSearch(lastWord.slice(1))
    } else {
      setShowMentions(false)
    }

    if (lastChar === '#' || (lastWord.startsWith('#') && lastWord.length > 1)) {
      setShowProjects(true)
      setProjectSearch(lastWord.slice(1))
    } else {
      setShowProjects(false)
    }
  }

  // Insert mention
  const insertMention = (member: TentMember) => {
    const lastAtIndex = newMessage.lastIndexOf('@')
    const beforeMention = newMessage.slice(0, lastAtIndex)
    const afterMention = newMessage.slice(lastAtIndex + mentionSearch.length + 1)
    const name = member.profiles?.full_name || member.profiles?.email || ''
    setNewMessage(`${beforeMention}@${name} ${afterMention}`)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  // Insert project link
  const insertProject = (project: Project) => {
    const lastHashIndex = newMessage.lastIndexOf('#')
    const beforeProject = newMessage.slice(0, lastHashIndex)
    const afterProject = newMessage.slice(lastHashIndex + projectSearch.length + 1)
    setNewMessage(`${beforeProject}#${project.project_name} ${afterProject}`)
    setShowProjects(false)
    textareaRef.current?.focus()
  }

  // Navigate to project
  const navigateToProject = (projectId: string) => {
    router.push(`/projects/${projectId}/edit`)
  }

  // Format message with links
  const formatMessage = (text: string) => {
    let formatted = text

    // Style @mentions
    const mentionRegex = /@(\w+(?:\s\w+)*)/g
    formatted = formatted.replace(mentionRegex, '<span class="text-blue-600 dark:text-blue-400 font-medium">@$1</span>')

    // Style #projects
    projects.forEach(project => {
      if (formatted.includes(`#${project.project_name}`)) {
        formatted = formatted.replace(
          new RegExp(`#${project.project_name}`, 'g'),
          `<span class="text-purple-600 dark:text-purple-400 font-medium cursor-pointer hover:underline" data-project-id="${project.id}">#${project.project_name}</span>`
        )
      }
    })

    return formatted
  }

  // Format timestamp
  const formatTimestamp = (date: string) => {
    const msgDate = new Date(date)
    if (isToday(msgDate)) {
      return format(msgDate, 'h:mm a')
    } else if (isYesterday(msgDate)) {
      return `Yesterday ${format(msgDate, 'h:mm a')}`
    } else {
      return format(msgDate, 'MMM d, h:mm a')
    }
  }

  // Get user initials
  const getUserInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }
    return email?.[0]?.toUpperCase() || 'U'
  }

  return (
    <Card className="flex flex-col h-[600px] glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Team Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No messages yet. Start a conversation!</p>
                <p className="text-xs mt-2">Use @ to mention team members, # to link projects</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.user_id === currentUserId
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      isOwnMessage && "flex-row-reverse"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {getUserInitials(message.profiles?.full_name, message.profiles?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "flex flex-col max-w-[70%]",
                        isOwnMessage && "items-end"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {message.profiles?.full_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.created_at)}
                        </span>
                        {message.edited_at && (
                          <span className="text-xs text-muted-foreground italic">
                            (edited)
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2",
                          isOwnMessage
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800"
                        )}
                        dangerouslySetInnerHTML={{ __html: formatMessage(message.message) }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          const projectId = target.getAttribute('data-project-id')
                          if (projectId) {
                            navigateToProject(projectId)
                          }
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t relative">
          {/* Mentions Popup */}
          {showMentions && tentMembers.length > 0 && (
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-2 max-h-40 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Mention a member
              </div>
              {tentMembers
                .filter(m => {
                  const name = m.profiles?.full_name || m.profiles?.email || ''
                  return name.toLowerCase().includes(mentionSearch.toLowerCase())
                })
                .map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => insertMention(member)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <AtSign className="h-3 w-3" />
                    <span className="text-sm">
                      {member.profiles?.full_name || member.profiles?.email}
                    </span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {member.tent_role}
                    </Badge>
                  </button>
                ))}
            </div>
          )}

          {/* Projects Popup */}
          {showProjects && projects.length > 0 && (
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-2 max-h-40 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Link a project
              </div>
              {projects
                .filter(p => 
                  p.project_name.toLowerCase().includes(projectSearch.toLowerCase())
                )
                .slice(0, 5)
                .map(project => (
                  <button
                    key={project.id}
                    onClick={() => insertProject(project)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Hash className="h-3 w-3" />
                    <span className="text-sm">{project.project_name}</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {project.status}
                    </Badge>
                  </button>
                ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleMessageInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Type a message... Use @ to mention, # to link projects"
              className="min-h-[60px] resize-none"
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </CardContent>
    </Card>
  )
}