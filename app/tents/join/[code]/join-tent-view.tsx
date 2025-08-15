'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tent, Users, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface TentMember {
  user_id: string
  tent_role: string
  is_admin: boolean
  profiles: {
    id: string
    full_name: string | null
    email: string
  }
}

interface Tent {
  id: string
  name: string
  description: string | null
  invite_code: string
  tent_members: TentMember[]
}

interface JoinTentViewProps {
  tent: Tent
  userId: string
}

export function JoinTentView({ tent }: JoinTentViewProps) {
  const [joining, setJoining] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleJoin = async () => {
    setJoining(true)

    try {
      const response = await fetch('/api/tents/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: tent.invite_code })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join tent')
      }

      toast({
        title: 'Success!',
        description: `You've joined ${tent.name}`
      })

      router.push(`/tents/${tent.id}`)
    } catch (error) {
      console.error('Error joining tent:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join tent',
        variant: 'destructive'
      })
      setJoining(false)
    }
  }

  // Determine what role the new user will get
  const existingMember = tent.tent_members?.[0]
  const newUserRole = existingMember?.tent_role === 'client' ? 'manager' : 'client'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Tent className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Tent</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a CreatorTent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-lg mb-2">{tent.name}</h3>
            {tent.description && (
              <p className="text-sm text-muted-foreground mb-4">{tent.description}</p>
            )}
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{tent.tent_members?.length || 0}/2 members</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Your role will be:</span>
                <Badge variant="outline" className="capitalize">
                  {newUserRole}
                </Badge>
              </div>
            </div>
          </div>

          {existingMember && (
            <div>
              <p className="text-sm font-medium mb-2">Current member:</p>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Avatar>
                  <AvatarFallback>
                    {existingMember.profiles?.full_name?.charAt(0) || 
                     existingMember.profiles?.email?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">
                    {existingMember.profiles?.full_name || existingMember.profiles?.email}
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {existingMember.tent_role} (Creator)
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <p className="text-sm">
              By joining this tent, you&apos;ll be able to:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {newUserRole === 'client' ? (
                <>
                  <li>• Create and submit invoices</li>
                  <li>• Track invoice status</li>
                  <li>• Receive notifications on approvals</li>
                </>
              ) : (
                <>
                  <li>• Review submitted invoices</li>
                  <li>• Approve or reject invoices</li>
                  <li>• Manage invoice workflow</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? 'Joining...' : 'Join Tent'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}