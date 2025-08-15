'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateRoomDialog } from './create-room-dialog'
import { JoinRoomDialog } from './join-room-dialog'
import { Users, Lock, LockOpen, Calendar, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface CollaborationRoom {
  id: string
  name: string
  description: string | null
  invite_code: string
  is_locked: boolean
  created_at: string
  created_by: string
  room_participants: Array<{
    user_id: string
    role: string
    profiles?: {
      email: string
      full_name: string | null
    }
  }>
}

interface RoomsListProps {
  workspaceId: string
  userId: string
}

export function RoomsList({ workspaceId, userId }: RoomsListProps) {
  const [rooms, setRooms] = useState<CollaborationRoom[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchRooms()
    
    // Set up real-time subscription
    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaboration_rooms',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchRooms()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const fetchRooms = async () => {
    try {
      // First get rooms where user is a participant
      const { data: participantRooms } = await supabase
        .from('room_participants')
        .select(`
          room_id,
          role,
          collaboration_rooms!inner (
            id,
            name,
            description,
            invite_code,
            is_locked,
            created_at,
            created_by,
            workspace_id
          )
        `)
        .eq('user_id', userId)
        .eq('collaboration_rooms.workspace_id', workspaceId)

      if (participantRooms) {
        // Transform the data and fetch participant details
        const roomsWithParticipants = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          participantRooms.map(async (pr: any) => {
            const room = pr.collaboration_rooms
            
            // Fetch all participants for this room
            const { data: participants } = await supabase
              .from('room_participants')
              .select(`
                user_id,
                role,
                profiles (
                  email,
                  full_name
                )
              `)
              .eq('room_id', room.id)

            return {
              ...room,
              room_participants: participants || []
            }
          })
        )

        setRooms(roomsWithParticipants)
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoomCreated = () => {
    fetchRooms()
  }

  const handleRoomJoined = () => {
    fetchRooms()
  }

  const navigateToRoom = (roomId: string) => {
    router.push(`/rooms/${roomId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Collaboration Rooms</h2>
          <p className="text-muted-foreground">Private two-party rooms for invoice collaboration</p>
        </div>
        <div className="flex gap-2">
          <JoinRoomDialog onRoomJoined={handleRoomJoined} />
          <CreateRoomDialog 
            workspaceId={workspaceId} 
            onRoomCreated={handleRoomCreated} 
          />
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No collaboration rooms yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a room to collaborate with one other person on invoices
            </p>
            <div className="flex gap-2">
              <JoinRoomDialog onRoomJoined={handleRoomJoined} />
              <CreateRoomDialog 
                workspaceId={workspaceId} 
                onRoomCreated={handleRoomCreated} 
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const isCreator = room.created_by === userId
            const participantCount = room.room_participants.length
            const otherParticipant = room.room_participants.find(p => p.user_id !== userId)
            
            return (
              <Card 
                key={room.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigateToRoom(room.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{room.name}</CardTitle>
                      {room.description && (
                        <CardDescription className="mt-1">
                          {room.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {room.is_locked ? (
                        <Badge variant="secondary">
                          <Lock className="h-3 w-3 mr-1" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <LockOpen className="h-3 w-3 mr-1" />
                          Open
                        </Badge>
                      )}
                      {isCreator && (
                        <Badge variant="default">Creator</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {participantCount}/2 participants
                      {otherParticipant && otherParticipant.profiles && (
                        <span className="ml-1">
                          • With {otherParticipant.profiles.full_name || otherParticipant.profiles.email}
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {!room.is_locked && isCreator && (
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs font-medium mb-1">Invite Code:</p>
                      <code className="font-mono text-lg font-bold">{room.invite_code}</code>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(room.created_at), 'MMM d, yyyy')}
                    </div>
                    <Button size="sm" variant="ghost">
                      Enter Room
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}