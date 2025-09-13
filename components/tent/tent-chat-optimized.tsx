'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  AtSign,
  Loader2,
  WifiOff,
  Zap
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
  // Optimization flags
  isOptimistic?: boolean  // Message sent but not confirmed
  isCached?: boolean      // Message from cache
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

// Cache configuration
const CACHE_KEY_PREFIX = 'tent-chat-cache-'
const CACHE_SIZE = 100 // Keep last 100 messages in cache
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const INITIAL_LOAD_SIZE = 50
const LOAD_MORE_SIZE = 25


export function TentChatOptimized({ tentId, currentUserId, tentMembers = [] }: TentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastMessageTimestamp = useRef<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  // Cache management
  const cacheKey = useMemo(() => `${CACHE_KEY_PREFIX}${tentId}`, [tentId])

  const saveToCache = useCallback((messages: ChatMessage[]) => {
    try {
      const cacheData = {
        messages: messages.slice(-CACHE_SIZE), // Keep only last N messages
        timestamp: Date.now(),
        version: '1.0'
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to save to cache:', error)
    }
  }, [cacheKey])


  // Optimized message fetching with pagination
  const fetchMessages = useCallback(async (loadMore = false) => {
    try {
      let query = supabase
        .from('tent_chat_messages')
        .select('*')
        .eq('tent_id', tentId)
        .order('created_at', { ascending: false })
        .limit(loadMore ? LOAD_MORE_SIZE : INITIAL_LOAD_SIZE)

      // If loading more, get messages before the oldest one we have
      if (loadMore && messages.length > 0) {
        const oldestMessage = messages[0]
        query = query.lt('created_at', oldestMessage.created_at)
      }

      const { data, error } = await query

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.log('Chat table not yet created. Please run migration 017_tent_chat_system.sql')
          setTableExists(false)
          setHasMore(false)
          return
        }
        // Handle network/fetch errors
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          console.log('Network error fetching messages, will retry...')
          setIsOffline(true)
          // Don't set tableExists to false for network errors
          return
        }
        console.error('Error fetching messages:', error)
        return
      }

      // Fetch profiles separately to avoid foreign key issues
      const userIds = [...new Set((data || []).map(msg => msg.user_id))]
      let enrichedMessages = data || []
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
        
        if (profiles) {
          enrichedMessages = enrichedMessages.map(msg => ({
            ...msg,
            profiles: profiles.find(p => p.id === msg.user_id) || null
          }))
        }
      }

      const fetchedMessages = enrichedMessages.reverse()
      
      if (loadMore) {
        setMessages(prev => [...fetchedMessages, ...prev])
        setHasMore(fetchedMessages.length === LOAD_MORE_SIZE)
      } else {
        setMessages(fetchedMessages)
        setHasMore(fetchedMessages.length === INITIAL_LOAD_SIZE)
        saveToCache(fetchedMessages)
      }
      
      // Update last message timestamp for real-time sync
      if (fetchedMessages.length > 0) {
        lastMessageTimestamp.current = fetchedMessages[fetchedMessages.length - 1].created_at
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      setIsOffline(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [tentId, messages, supabase, saveToCache])

  // Load more messages when scrolling to top
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    if (element.scrollTop === 0 && hasMore && !loadingMore) {
      setLoadingMore(true)
      fetchMessages(true)
    }
  }, [hasMore, loadingMore, fetchMessages])

  // Fetch projects for linking (with caching)
  const fetchProjects = useCallback(async () => {
    try {
      // Check if we have cached projects
      const cachedProjects = sessionStorage.getItem(`projects-${tentId}`)
      if (cachedProjects) {
        setProjects(JSON.parse(cachedProjects))
      }

      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_name, status')
        .eq('tent_id', tentId)
        .order('created_at', { ascending: false })
        .limit(20) // Only get recent projects for mentions

      if (!error && data) {
        setProjects(data)
        sessionStorage.setItem(`projects-${tentId}`, JSON.stringify(data))
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }, [tentId, supabase])

  // Initialize with cache, then fetch fresh data
  useEffect(() => {
    // Load from cache immediately for instant display
    const cacheKey = `tent-chat-${tentId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const { messages: cachedMessages, timestamp } = JSON.parse(cached)
        const isExpired = Date.now() - timestamp > CACHE_TTL
        if (!isExpired && Array.isArray(cachedMessages) && cachedMessages.length > 0) {
          setMessages(cachedMessages.map(msg => ({ ...msg, isCached: true })))
          setLoading(false) // Show cached content immediately
        }
      } catch (error) {
        console.error('Error loading cache:', error)
      }
    }
    
    // Fetch messages and projects
    fetchMessages()
    fetchProjects()
  }, [tentId, fetchMessages, fetchProjects]) // Include the functions in deps

  // Optimized real-time subscription
  useEffect(() => {
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
          // Skip if this is our own optimistic message
          if (payload.new.user_id === currentUserId) {
            // Replace optimistic message with real one
            setMessages(prev => prev.map(msg => 
              msg.isOptimistic && msg.message === payload.new.message
                ? { ...payload.new, profiles: msg.profiles, isOptimistic: false }
                : msg
            ))
          } else {
            // Fetch the full message
            const { data: messageData } = await supabase
              .from('tent_chat_messages')
              .select('*')
              .eq('id', payload.new.id)
              .single()

            if (messageData) {
              // Fetch profile separately
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('id', messageData.user_id)
                .single()
              
              const enrichedMessage = {
                ...messageData,
                profiles: profileData || null
              }
              
              setMessages(prev => {
                const updated = [...prev, enrichedMessage]
                saveToCache(updated)
                return updated
              })
              // Don't auto-scroll for incoming messages from others
            }
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        setIsConnected(true)
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tentId, currentUserId, supabase, saveToCache])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Scroll to bottom of messages - only when user sends a message
  const scrollToBottom = () => {
    // Don't use scrollIntoView as it can affect the entire page
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  // Remove the auto-scroll effect to prevent locking the view
  // Only scroll on specific user actions, not on every message update

  // Optimistic message sending
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return

    const messageText = newMessage.trim()
    const optimisticMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      tent_id: tentId,
      user_id: currentUserId,
      message: messageText,
      created_at: new Date().toISOString(),
      isOptimistic: true,
      profiles: {
        id: currentUserId,
        full_name: tentMembers.find(m => m.user_id === currentUserId)?.profiles?.full_name || null,
        email: tentMembers.find(m => m.user_id === currentUserId)?.profiles?.email || ''
      }
    }

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')
    scrollToBottom()
    
    setSending(true)
    try {
      // Just send the basic fields - let the database defaults handle the arrays
      const { error } = await supabase
        .from('tent_chat_messages')
        .insert({
          tent_id: tentId,
          user_id: currentUserId,
          message: messageText
        })

      if (error) throw error
      
      textareaRef.current?.focus()
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      setNewMessage(messageText) // Restore message for retry
      
      // More detailed error logging
      const errorObj = error as { message?: string; code?: string }
      console.error('Error sending message:', errorObj?.message || error)
      
      if (errorObj?.code === '42P01' || errorObj?.message?.includes('does not exist') || errorObj?.message?.includes('relation')) {
        setTableExists(false)
        toast({
          title: 'Chat Setup Required',
          description: 'Chat table not found. Please run migration 017_tent_chat_system.sql in your Supabase SQL editor.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Error',
          description: errorObj?.message || 'Failed to send message. Please try again.',
          variant: 'destructive'
        })
      }
    } finally {
      setSending(false)
    }
  }

  // Message input handler
  const handleMessageInput = useCallback((value: string) => {
    const lastWord = value.split(' ').pop() || ''
    
    if (value[value.length - 1] === '@' || (lastWord.startsWith('@') && lastWord.length > 1)) {
      setShowMentions(true)
      setMentionSearch(lastWord.slice(1))
    } else {
      setShowMentions(false)
    }

    if (value[value.length - 1] === '#' || (lastWord.startsWith('#') && lastWord.length > 1)) {
      setShowProjects(true)
      setProjectSearch(lastWord.slice(1))
    } else {
      setShowProjects(false)
    }
  }, [])

  const onMessageInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNewMessage(value)
    handleMessageInput(value)
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Team Chat
          </div>
          <div className="flex items-center gap-2">
            {isOffline && (
              <Badge variant="secondary" className="text-xs">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            {!isConnected && !isOffline && (
              <Badge variant="secondary" className="text-xs">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Connecting...
              </Badge>
            )}
            {isConnected && !isOffline && (
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                <Zap className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 px-4"
          onScroll={handleScroll}
        >
          <div className="space-y-4 py-4">
            {loadingMore && (
              <div className="text-center text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 mx-auto animate-spin" />
              </div>
            )}
            
            {!tableExists ? (
              <div className="text-center py-8">
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-6 max-w-md mx-auto">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-amber-600" />
                  <h3 className="font-semibold mb-2">Chat Setup Required</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    To enable chat, please run the following migration in your Supabase SQL editor:
                  </p>
                  <code className="block bg-gray-100 dark:bg-gray-800 rounded p-2 text-xs">
                    017_tent_chat_system.sql
                  </code>
                  <p className="text-xs text-muted-foreground mt-4">
                    This will create the necessary tables for real-time chat.
                  </p>
                </div>
              </div>
            ) : loading && messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
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
                      "flex gap-3 transition-opacity duration-200",
                      isOwnMessage && "flex-row-reverse",
                      message.isOptimistic && "opacity-70",
                      message.isCached && "opacity-90"
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
                        {message.isOptimistic && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 transition-colors",
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
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t relative">
          {/* Show setup message if table doesn't exist */}
          {!tableExists ? (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Chat is not available until the migration is run.</p>
            </div>
          ) : (
            <>
          {/* Mentions Popup */}
          {showMentions && tentMembers.length > 0 && (
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-2 max-h-40 overflow-y-auto z-50">
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
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-2 max-h-40 overflow-y-auto z-50">
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
              onChange={onMessageInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={isOffline ? "You're offline - messages will send when connected" : "Type a message... Use @ to mention, # to link projects"}
              className="min-h-[60px] resize-none"
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="self-end"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2 flex justify-between">
            <span>Press Enter to send, Shift+Enter for new line</span>
            {messages.some(m => m.isCached) && (
              <span className="text-amber-600">
                Showing cached messages
              </span>
            )}
          </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}