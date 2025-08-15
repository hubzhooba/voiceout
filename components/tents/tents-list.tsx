'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tent, Users, Copy, ExternalLink } from 'lucide-react'
import { CreateTentDialog } from './create-tent-dialog'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface TentMember {
  user_id: string
  tent_role: string
  is_admin: boolean
  profiles: {
    id: string
    full_name: string
    email: string
  }
}

interface Tent {
  id: string
  name: string
  description: string
  invite_code: string
  is_locked: boolean
  created_at: string
  creator_role: string
  tent_members: TentMember[]
}

export function TentsList() {
  const [tents, setTents] = useState<Tent[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchTents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      setUserId(user.id)

      // Try a simpler query that avoids the recursive policy
      // Just get tents without the nested members for now
      const { data: memberData, error: memberError } = await supabase
        .from('tent_members')
        .select('tent_id')
        .eq('user_id', user.id)

      if (memberError) {
        // If we get a recursion error, show a helpful message
        if (memberError.message?.includes('infinite recursion')) {
          console.error('Database policy error detected. Please contact support to fix the database policies.')
          toast({
            title: 'Database Configuration Issue',
            description: 'There is a configuration issue with the database. Please run the fix_recursion.sql script in your Supabase SQL Editor.',
            variant: 'destructive'
          })
          setTents([])
          return
        }
        throw memberError
      }

      const tentIds = memberData?.map(m => m.tent_id) || []
      
      if (tentIds.length === 0) {
        setTents([])
        return
      }

      // Fetch tents without nested members to avoid recursion
      const { data, error } = await supabase
        .from('tents')
        .select('*')
        .in('id', tentIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Now fetch members separately for each tent
      const tentsWithMembers = await Promise.all(
        (data || []).map(async (tent) => {
          const { data: members } = await supabase
            .from('tent_members')
            .select(`
              user_id,
              tent_role,
              is_admin,
              profiles (
                id,
                full_name,
                email
              )
            `)
            .eq('tent_id', tent.id)
          
          return {
            ...tent,
            tent_members: members || []
          }
        })
      )
      
      setTents(tentsWithMembers)
    } catch (error) {
      console.error('Error fetching tents:', error)
      toast({
        title: 'Error',
        description: 'Failed to load tents',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({
      title: 'Copied!',
      description: 'Invite code copied to clipboard'
    })
  }

  const navigateToTent = (tentId: string) => {
    router.push(`/tents/${tentId}`)
  }

  if (loading) {
    return <div className="text-center py-8">Loading tents...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Your Tents</h2>
          <p className="text-muted-foreground">
            Collaborate with one other person in each tent
          </p>
        </div>
        <CreateTentDialog onTentCreated={fetchTents} />
      </div>

      {tents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Tent className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tents yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first tent to start collaborating on invoices
            </p>
            <CreateTentDialog onTentCreated={fetchTents} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tents.map((tent) => {
            const memberCount = tent.tent_members?.length || 0
            const currentUserMember = tent.tent_members?.find(m => m.user_id === userId) || null
            const otherMember = tent.tent_members?.find(m => m.user_id !== userId) || null
            
            return (
              <Card key={tent.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1" onClick={() => navigateToTent(tent.id)}>
                      <CardTitle className="flex items-center gap-2">
                        <Tent className="h-5 w-5" />
                        {tent.name}
                      </CardTitle>
                      {tent.description && (
                        <CardDescription className="mt-1">
                          {tent.description}
                        </CardDescription>
                      )}
                    </div>
                    {currentUserMember?.is_admin && !tent.is_locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyInviteCode(tent.invite_code)
                        }}
                        title="Copy invite code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent onClick={() => navigateToTent(tent.id)}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {memberCount}/2 members
                      </span>
                      {tent.is_locked && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">Full</span>
                      )}
                    </div>

                    {currentUserMember && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Your role:</span>
                        <span className="capitalize bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {currentUserMember.tent_role}
                        </span>
                        {currentUserMember.is_admin && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                    )}

                    {otherMember && (
                      <div className="text-sm">
                        <span className="font-medium">Partner:</span>{' '}
                        <span className="text-muted-foreground">
                          {otherMember.profiles?.full_name || otherMember.profiles?.email}
                        </span>
                      </div>
                    )}

                    {!tent.is_locked && currentUserMember?.is_admin && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Invite code:</span>
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                            {tent.invite_code}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigateToTent(tent.id)
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Enter Tent
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}