'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Database } from '@/types/database'

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [invitation, setInvitation] = useState<Database['public']['Tables']['workspace_invitations']['Row'] | null>(null)
  const [workspace, setWorkspace] = useState<Database['public']['Tables']['workspaces']['Row'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchInvitation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchInvitation = async () => {
    const { data: inviteData, error: inviteError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('id', params.id)
      .eq('status', 'pending')
      .single()

    if (inviteError || !inviteData) {
      toast({
        title: "Invalid Invitation",
        description: "This invitation is invalid or has already been used.",
        variant: "destructive",
      })
      router.push('/auth/login')
      return
    }

    const { data: workspaceData } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', inviteData.workspace_id)
      .single()

    setInvitation(inviteData)
    setWorkspace(workspaceData)
    setLoading(false)
  }

  const acceptInvitation = async () => {
    setProcessing(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to accept this invitation.",
      })
      router.push(`/auth/login?redirect=/invitations/${params.id}`)
      return
    }

    if (!invitation || user.email !== invitation.email) {
      toast({
        title: "Email mismatch",
        description: "Please log in with the email address this invitation was sent to.",
        variant: "destructive",
      })
      setProcessing(false)
      return
    }

    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (memberError && !memberError.message.includes('duplicate')) {
      toast({
        title: "Error",
        description: "Failed to add you to the workspace.",
        variant: "destructive",
      })
      setProcessing(false)
      return
    }

    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to update invitation status.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success!",
        description: `You&apos;ve been added to ${workspace?.name}`,
      })
      router.push('/dashboard')
    }

    setProcessing(false)
  }

  const declineInvitation = async () => {
    setProcessing(true)

    const { error } = await supabase
      .from('workspace_invitations')
      .update({ status: 'declined' })
      .eq('id', params.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to decline invitation.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Invitation declined",
        description: "You have declined the invitation.",
      })
      router.push('/auth/login')
    }

    setProcessing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Workspace Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Workspace</p>
            <p className="font-medium text-lg">{workspace?.name}</p>
            {workspace?.description && (
              <p className="text-sm text-muted-foreground">{workspace.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Your role</p>
            <p className="font-medium capitalize">{invitation?.role}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Invited to</p>
            <p className="font-medium">{invitation?.email}</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={acceptInvitation}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Accept Invitation
            </Button>
            <Button
              variant="outline"
              onClick={declineInvitation}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}