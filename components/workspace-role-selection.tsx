'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { UserCircle, Briefcase, Link, Copy, Check, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

interface WorkspaceRoleSelectionProps {
  workspace: Workspace
  userId: string
  onRoleSelected: (role: 'client' | 'manager' | 'admin') => void
  onComplete: () => void
}

export function WorkspaceRoleSelection({ 
  workspace, 
  userId, 
  onRoleSelected,
  onComplete 
}: WorkspaceRoleSelectionProps) {
  const [selectedRole, setSelectedRole] = useState<'client' | 'manager' | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'client' | 'manager'>('client')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleRoleSelection = async (role: 'client' | 'manager') => {
    setSelectedRole(role)
    onRoleSelected(role)
    
    // Update user's primary role in workspace_members
    const { error } = await supabase
      .from('workspace_members')
      .update({ 
        role: role === 'manager' ? 'manager' : 'user',
        primary_role: role 
      })
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error updating role:', error)
    }

    toast({
      title: "Role Selected",
      description: `You're now set up as a ${role} in this workspace.`,
    })

    // Show invite dialog after role selection
    setInviteRole(role === 'client' ? 'manager' : 'client')
    setShowInviteDialog(true)
  }

  const generateInviteLink = async () => {
    setLoading(true)
    
    try {
      const { data: invitation, error } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspace.id,
          email: inviteEmail || 'pending@example.com', // Use placeholder if just generating link
          role: inviteRole === 'manager' ? 'manager' : 'user',
          invited_by: userId,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      const link = `${window.location.origin}/invitations/${invitation.id}?role=${inviteRole}`
      setInviteLink(link)
      
      if (inviteEmail) {
        // TODO: Send email with invite link
        toast({
          title: "Invitation Sent",
          description: `Invitation sent to ${inviteEmail}`,
        })
      }
    } catch (error) {
      console.error('Error creating invitation:', error)
      toast({
        title: "Error",
        description: "Failed to create invitation link",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    })
  }

  const handleSkip = () => {
    onRoleSelected('admin')
    onComplete()
  }

  if (!selectedRole && !showInviteDialog) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Welcome to {workspace.name}!</h1>
            <p className="text-muted-foreground">
              Let&apos;s set up your workspace. What&apos;s your primary role?
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleRoleSelection('client')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <UserCircle className="h-8 w-8 text-primary" />
                  <CardTitle>I&apos;m a Client</CardTitle>
                </div>
                <CardDescription>
                  I need to submit invoices and track my service records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Create and submit invoices</li>
                  <li>• Track payment status</li>
                  <li>• View service history</li>
                  <li>• Receive notifications from managers</li>
                </ul>
                <Button className="w-full mt-4" variant="outline">
                  Select Client Role
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleRoleSelection('manager')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Briefcase className="h-8 w-8 text-primary" />
                  <CardTitle>I&apos;m a Manager</CardTitle>
                </div>
                <CardDescription>
                  I review and process invoices from clients
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Review submitted invoices</li>
                  <li>• Approve or reject submissions</li>
                  <li>• Upload scanned documents</li>
                  <li>• Manage team members</li>
                </ul>
                <Button className="w-full mt-4" variant="outline">
                  Select Manager Role
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              <Link className="mr-2 h-4 w-4" />
              Just give me an invite link to share
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Invite Your {inviteRole === 'manager' ? 'Manager' : 'Clients'}
          </DialogTitle>
          <DialogDescription>
            {inviteRole === 'manager' 
              ? "Share this workspace with your manager so they can process your invoices"
              : "Invite clients to submit invoices to this workspace"
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address (Optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder={`${inviteRole}@example.com`}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to just generate a shareable link
            </p>
          </div>

          {!inviteLink ? (
            <Button 
              onClick={generateInviteLink} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating...' : 'Generate Invite Link'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setInviteLink('')
                    setInviteEmail('')
                  }}
                >
                  Create Another
                </Button>
                <Button onClick={onComplete} className="flex-1">
                  Continue to Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}