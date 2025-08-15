'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Users, AlertCircle, CheckCircle } from 'lucide-react'

interface JoinRoomPageProps {
  room: {
    id: string
    name: string
    description: string | null
    is_locked: boolean
  }
  inviteCode: string
  isFull: boolean
  userId: string
}

export function JoinRoomPage({ room, inviteCode, isFull }: JoinRoomPageProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleJoin = async () => {
    setLoading(true)

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

      toast({
        title: 'Success!',
        description: 'You have successfully joined the collaboration room',
      })

      // Navigate to the room
      router.push(`/rooms/${room.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join Collaboration Room</CardTitle>
          <CardDescription>
            You&apos;ve been invited to collaborate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">{room.name}</h3>
            {room.description && (
              <p className="text-sm text-muted-foreground">{room.description}</p>
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Invite Code</p>
            <div className="font-mono text-2xl font-bold">{inviteCode.toUpperCase()}</div>
          </div>

          {isFull ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This room is already full. Collaboration rooms are limited to 2 participants.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Once you join, this room will be locked to just you and the room creator.
                  You&apos;ll be able to collaborate privately on invoices.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/dashboard')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </Button>
              </div>
            </>
          )}

          {isFull && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}