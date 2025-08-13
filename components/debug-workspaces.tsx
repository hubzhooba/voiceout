'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DebugData {
  user?: string
  userEmail?: string
  directWorkspaces?: unknown[]
  directError?: string
  members?: unknown[]
  membersError?: string
  joined?: unknown[]
  joinedError?: string
  owned?: unknown[]
  ownedError?: string
}

export function DebugWorkspaces() {
  const [data, setData] = useState<DebugData>({})
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchDebugData() {
      const supabase = createClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      // Try different queries
      const results: DebugData = {
        user: user?.id,
        userEmail: user?.email
      }
      
      // Query 1: Direct workspaces
      const { data: directWorkspaces, error: directError } = await supabase
        .from('workspaces')
        .select('*')
      
      results.directWorkspaces = directWorkspaces || undefined
      results.directError = directError?.message
      
      // Query 2: Workspace members
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('user_id', user?.id || '')
      
      results.members = members || undefined
      results.membersError = membersError?.message
      
      // Query 3: Joined query
      const { data: joined, error: joinedError } = await supabase
        .from('workspace_members')
        .select(`
          *,
          workspace:workspace_id (*)
        `)
        .eq('user_id', user?.id || '')
      
      results.joined = joined || undefined
      results.joinedError = joinedError?.message
      
      // Query 4: User owned workspaces
      const { data: owned, error: ownedError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user?.id || '')
      
      results.owned = owned || undefined
      results.ownedError = ownedError?.message
      
      setData(results)
      setLoading(false)
    }
    
    fetchDebugData()
  }, [])
  
  if (loading) return <div>Loading debug info...</div>
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Debug: Workspace Data</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs overflow-auto max-h-96 bg-muted p-2 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}