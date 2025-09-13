'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, CheckCheck, FileText, UserPlus, AlertCircle, TrendingUp, Package, Clock, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { useNotifications } from '@/components/providers/notification-provider'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface DBNotification {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>
  read: boolean
  created_at: string
}

export function NotificationBell() {
  const { notifications: contextNotifications, unreadCount: contextUnreadCount, markAsRead: contextMarkAsRead, markAllAsRead: contextMarkAllAsRead } = useNotifications()
  const [dbNotifications, setDbNotifications] = useState<DBNotification[]>([])
  const [dbUnreadCount, setDbUnreadCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()
  
  // Combine both notification sources
  const totalUnreadCount = contextUnreadCount + dbUnreadCount
  
  // Fetch database notifications
  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      setDbNotifications(data)
      setDbUnreadCount(data.filter(n => !n.read).length)
    }
  }
  
  // Mark database notification as read
  const markDbNotificationAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    setDbNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setDbUnreadCount(prev => Math.max(0, prev - 1))
  }
  
  // Mark all as read (both sources)
  const markAllAsRead = async () => {
    // Mark context notifications as read
    contextMarkAllAsRead()
    
    // Mark DB notifications as read
    const unreadIds = dbNotifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds)

      setDbNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setDbUnreadCount(0)
    }
  }
  
  useEffect(() => {
    fetchNotifications()
    
    // Set up real-time subscription
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setDbNotifications(prev => [payload.new as DBNotification, ...prev])
            setDbUnreadCount(prev => prev + 1)
          }
        )
        .subscribe()
      
      return () => {
        supabase.removeChannel(channel)
      }
    }
    
    setupSubscription()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chat_mention':
        return <MessageSquare className="h-4 w-4 text-green-500" />
      case 'workflow_update':
        return <TrendingUp className="h-4 w-4 text-blue-500" />
      case 'project_update':
        return <Package className="h-4 w-4 text-purple-500" />
      case 'status_update':
        return <Clock className="h-4 w-4 text-amber-500" />
      case 'invoice_status':
        return <FileText className="h-4 w-4 text-green-500" />
      case 'workspace_invitation':
        return <UserPlus className="h-4 w-4 text-indigo-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNotificationClick = async (notification: any) => {
    // Check if it's a DB notification or context notification
    const isDbNotification = dbNotifications.some(n => n.id === notification.id)
    
    if (isDbNotification) {
      await markDbNotificationAsRead(notification.id)
      // Navigate for DB notifications (chat mentions, etc)
      if (notification.link) {
        router.push(notification.link)
      }
    } else {
      // Handle context notifications
      await contextMarkAsRead(notification.id)
      // Navigate to relevant page
      if (notification.data?.project_id) {
        router.push(`/projects/${notification.data.project_id}`)
      } else if (notification.data?.tent_id) {
        router.push(`/tents/${notification.data.tent_id}`)
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover-icon"
        >
          <Bell className={cn(
            "h-5 w-5 transition-colors",
            totalUnreadCount > 0 && "text-amber-500"
          )} />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center font-bold">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between sticky top-0 bg-background z-10 pb-2">
          <span className="text-base font-semibold">Notifications</span>
          {totalUnreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {contextNotifications.length === 0 && dbNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-muted-foreground">
              No new notifications
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You&apos;re all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {[...contextNotifications, ...dbNotifications.map(n => ({
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message || '',
              created_at: n.created_at,
              read: n.read,
              data: n.metadata
            }))].map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer transition-colors",
                  "hover:bg-blue-50 dark:hover:bg-blue-950/20",
                  !notification.read && "bg-blue-50/50 dark:bg-blue-950/10"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight mb-1">
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                      {notification.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70">
                    {format(new Date(notification.created_at), 'MMM dd, h:mm a')}
                  </p>
                </div>
                {!notification.read && (
                  <div className="mt-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}