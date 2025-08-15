'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TentsList } from '@/components/tents/tents-list'
import { NotificationsDropdown } from '@/components/notifications-dropdown'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { LogOut, Tent } from 'lucide-react'

type Profile = Database['public']['Tables']['profiles']['Row']
type Notification = Database['public']['Tables']['notifications']['Row']

interface TentDashboardProps {
  user: User
  profile: Profile | null
}

export function TentDashboard({ user, profile }: TentDashboardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    fetchNotifications()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (data) {
      setNotifications(data)
    }
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive'
      })
    } else {
      router.push('/auth/login')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Tent className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">CreatorTent</span>
              </div>
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome to CreatorTent</h1>
          <p className="text-muted-foreground mt-2">
            Create tents to collaborate on invoices with your partners
          </p>
        </div>

        <TentsList />
      </div>
    </div>
  )
}