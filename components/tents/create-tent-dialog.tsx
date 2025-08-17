'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Copy, Tent, Check, User, Briefcase } from 'lucide-react'

interface CreateTentDialogProps {
  onTentCreated?: (tent: { id: string; name: string }) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateTentDialog({ onTentCreated, open: controlledOpen, onOpenChange }: CreateTentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [loading, setLoading] = useState(false)
  const [tentName, setTentName] = useState('')
  const [description, setDescription] = useState('')
  const [creatorRole, setCreatorRole] = useState<'client' | 'manager'>('client')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [invitedUserRole, setInvitedUserRole] = useState('')
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCreate = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    console.log('Creating tent with:', { tentName, description, creatorRole })
    
    if (!tentName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a tent name',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tentName,
          description,
          creatorRole,
        }),
      })

      const data = await response.json()
      console.log('API Response:', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tent')
      }

      setInviteCode(data.inviteCode)
      setInviteLink(data.inviteLink)
      setInvitedUserRole(data.invitedUserRole)
      
      toast({
        title: 'Success',
        description: 'Your tent has been created successfully!',
      })

      if (onTentCreated) {
        onTentCreated(data.tent)
      }
    } catch (err) {
      console.error('Create tent error:', err)
      toast({
        title: 'Error',
        description: (err as Error).message || 'Failed to create tent',
        variant: 'destructive',
      })
      setLoading(false) // Reset loading state on error
    } finally {
      if (!inviteCode) {
        setLoading(false)
      }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: 'Copied!',
        description: 'Invite code copied to clipboard',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  const handleClose = () => {
    setOpen(false)
    // Reset form after closing
    setTimeout(() => {
      setTentName('')
      setDescription('')
      setCreatorRole('client')
      setInviteCode('')
      setInviteLink('')
      setInvitedUserRole('')
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Tent className="mr-2 h-4 w-4" />
            Create Tent
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Your Tent</DialogTitle>
          <DialogDescription>
            Set up a private workspace for invoice management with one partner.
          </DialogDescription>
        </DialogHeader>

        {!inviteCode ? (
          <>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tent Name *</Label>
                <Input
                  id="name"
                  value={tentName}
                  onChange={(e) => setTentName(e.target.value)}
                  placeholder="e.g., Q4 2024 Invoices"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this tent..."
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div className="space-y-3">
                <Label>Your Role in this Tent *</Label>
                <RadioGroup value={creatorRole} onValueChange={(value) => setCreatorRole(value as 'client' | 'manager')}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="client" id="client" />
                    <Label htmlFor="client" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Client</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        I&apos;ll be submitting invoices for approval
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="manager" id="manager" />
                    <Label htmlFor="manager" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span className="font-medium">Manager</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        I&apos;ll be reviewing and approving invoices
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Your partner will automatically be assigned as {creatorRole === 'client' ? 'Manager' : 'Client'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading} type="button">
                {loading ? 'Creating...' : 'Create Tent'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4 space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Tent Created Successfully!</h3>
                <p className="text-sm text-muted-foreground">
                  Share the invite code below with your {invitedUserRole} partner.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Invite Code</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 font-mono text-2xl font-bold text-center py-2 bg-muted rounded">
                          {inviteCode}
                        </div>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(inviteCode)}
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Or share this link</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={inviteLink}
                          readOnly
                          className="text-xs"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(inviteLink)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-900 mb-1">Role Assignment:</p>
                      <p className="text-xs text-blue-800">
                        • You: <strong>{creatorRole === 'client' ? 'Client' : 'Manager'}</strong> (Admin)
                        <br />
                        • Your Partner: <strong>{invitedUserRole === 'client' ? 'Client' : 'Manager'}</strong>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> This tent will be locked after your partner joins. 
                  As the tent creator, you&apos;ll have admin privileges to manage settings.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}