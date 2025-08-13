'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Mail, UserX, Shield, User, UserCog, X } from 'lucide-react'
import { Database } from '@/types/database'

type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'] & {
  profiles: {
    full_name: string | null
    email: string
  }
}

type WorkspaceInvitation = Database['public']['Tables']['workspace_invitations']['Row']

interface TeamManagementProps {
  workspaceId: string
  currentUserId: string
  userRole: 'user' | 'manager' | 'admin'
}

export function TeamManagement({ workspaceId, currentUserId, userRole }: TeamManagementProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'user' | 'manager' | 'admin'>('user')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchMembers()
    fetchInvitations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('workspace_id', workspaceId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch team members",
        variant: "destructive",
      })
    } else {
      setMembers(data as WorkspaceMember[])
    }
  }

  const fetchInvitations = async () => {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')

    if (!error && data) {
      setInvitations(data)
    }
  }

  const sendInvitation = async () => {
    setLoading(true)

    const { error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email: inviteEmail,
        role: inviteRole,
        invited_by: currentUserId,
        status: 'pending',
      })

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      })
      setInviteEmail('')
      setShowInviteDialog(false)
      fetchInvitations()
    }

    setLoading(false)
  }

  const updateMemberRole = async (memberId: string, newRole: 'user' | 'manager' | 'admin') => {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Member role updated",
      })
      fetchMembers()
    }
  }

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Member removed from workspace",
      })
      fetchMembers()
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from('workspace_invitations')
      .update({ status: 'rejected' })
      .eq('id', invitationId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Invitation cancelled",
      })
      fetchInvitations()
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />
      case 'manager':
        return <UserCog className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'manager':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const canManageTeam = userRole === 'admin' || userRole === 'manager'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your workspace team members and their roles
              </CardDescription>
            </div>
            {canManageTeam && (
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join this workspace
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={inviteRole} onValueChange={(value: 'user' | 'manager' | 'admin') => setInviteRole(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          {userRole === 'admin' && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={sendInvitation} 
                      disabled={!inviteEmail || loading}
                      className="w-full"
                    >
                      {loading ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {canManageTeam && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.profiles.full_name || 'Not set'}
                  </TableCell>
                  <TableCell>{member.profiles.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleColor(member.role)} className="gap-1">
                      {getRoleIcon(member.role)}
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joined_at).toLocaleDateString()}
                  </TableCell>
                  {canManageTeam && (
                    <TableCell>
                      {member.user_id !== currentUserId && (
                        <div className="flex items-center gap-2">
                          {userRole === 'admin' && (
                            <Select 
                              value={member.role} 
                              onValueChange={(value: 'user' | 'manager' | 'admin') => 
                                updateMemberRole(member.id, value)
                              }
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(member.id)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManageTeam && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations that haven&apos;t been accepted yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  {userRole === 'admin' && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invitation.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleColor(invitation.role)}>
                        {invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </TableCell>
                    {userRole === 'admin' ? (
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Invitation?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel the invitation to {invitation.email}?
                              They will no longer be able to join the workspace with this invitation.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelInvitation(invitation.id)}>
                              Cancel Invitation
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}