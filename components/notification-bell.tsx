'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, CheckCheck, FileText, UserPlus, AlertCircle, TrendingUp, Package, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useNotifications } from '@/components/providers/notification-provider'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const router = useRouter()

  const getNotificationIcon = (type: string) => {
    switch (type) {
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

  const handleNotificationClick = async (notification: {
    id: string
    data?: {
      project_id?: string
      tent_id?: string
    }
  }) => {
    // Mark as read
    await markAsRead(notification.id)
    
    // Navigate to relevant page
    if (notification.data?.project_id) {
      router.push(`/projects/${notification.data.project_id}`)
    } else if (notification.data?.tent_id) {
      router.push(`/tents/${notification.data.tent_id}`)
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
            unreadCount > 0 && "text-amber-500"
          )} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between sticky top-0 bg-background z-10 pb-2">
          <span className="text-base font-semibold">Notifications</span>
          {unreadCount > 0 && (
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
        
        {notifications.length === 0 ? (
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
            {notifications.map((notification) => (
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