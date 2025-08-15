'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, AlertCircle } from 'lucide-react'

interface JoinRoomDialogProps {
  onRoomJoined?: (room: { id: string; name: string }) => void
}

export function JoinRoomDialog({ onRoomJoined }: JoinRoomDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  const handleJoin = async () => {
    if (inviteCode.length !== 6) {
      setError('Invite code must be exactly 6 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.toUpperCase(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join room')
      }

      if (data.alreadyMember) {
        toast({
          title: 'Already a member',
          description: 'You are already a member of this room',
        })
      } else {
        toast({
          title: 'Success!',
          description: 'You have successfully joined the collaboration room',
        })
      }

      setOpen(false)
      setInviteCode('')
      
      if (onRoomJoined) {
        onRoomJoined(data.room)
      }
      
      // Navigate to the room
      router.push(`/rooms/${data.room.id}`)
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric characters and limit to 6
    const filtered = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setInviteCode(filtered)
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Join Room
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Collaboration Room</DialogTitle>
          <DialogDescription>
            Enter the 6-character invite code shared with you to join a collaboration room.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Invite Code</Label>
            <Input
              id="code"
              value={inviteCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="font-mono text-lg text-center uppercase"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inviteCode.length === 6) {
                  handleJoin()
                }
              }}
            />
            <p className="text-xs text-muted-foreground text-center">
              {inviteCode.length}/6 characters
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Info:</strong> Collaboration rooms are limited to 2 participants. 
              Once you join, the room will be locked to just you and the room creator.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false)
              setInviteCode('')
              setError('')
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleJoin} 
            disabled={loading || inviteCode.length !== 6}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}