'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Copy, UserPlus, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TentMember {
  user_id: string
  tent_role: string | null
  is_admin: boolean
  profiles?: {
    id: string
    full_name: string | null
    email: string
  }
}

interface Tent {
  id: string
  name: string
  invite_code: string
  is_locked: boolean
  creator_role: string | null
  tent_members: TentMember[]
}

interface TentMembersProps {
  tent: Tent
  currentUserId: string
  isAdmin: boolean
}

export function TentMembers({ tent, currentUserId, isAdmin }: TentMembersProps) {
  const { toast } = useToast()

  const copyInviteCode = () => {
    navigator.clipboard.writeText(tent.invite_code)
    toast({
      title: 'Copied!',
      description: 'Invite code copied to clipboard'
    })
  }

  const copyInviteLink = () => {
    const link = `${window.location.origin}/tents/join/${tent.invite_code}`
    navigator.clipboard.writeText(link)
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard'
    })
  }

  const members = tent.tent_members || []
  const isFull = members.length >= 2

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      {!isFull && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Partner
            </CardTitle>
            <CardDescription>
              Share the invite code with your partner to join this tent.
              They will automatically be assigned the {tent.creator_role === 'client' ? 'manager' : 'client'} role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Invite Code</label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-lg text-center">
                  {tent.invite_code}
                </code>
                <Button variant="outline" onClick={copyInviteCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Invite Link</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/tents/join/${tent.invite_code}`}
                  className="flex-1 bg-muted px-3 py-2 rounded text-sm"
                />
                <Button variant="outline" onClick={copyInviteLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Tent Members ({members.length}/2)</CardTitle>
          <CardDescription>
            People who have access to this tent and its invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member: TentMember) => {
              const profile = member.profiles
              const isCurrentUser = member.user_id === currentUserId
              
              return (
                <div key={member.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {profile?.full_name || profile?.email || 'Unknown User'}
                        {isCurrentUser && ' (You)'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {profile?.email}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {member.tent_role}
                    </Badge>
                    {member.is_admin && (
                      <Badge variant="default" className="bg-amber-100 text-amber-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {isFull && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                This tent is full. Only 2 members are allowed per tent.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}