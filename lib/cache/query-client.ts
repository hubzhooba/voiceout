import { QueryClient } from '@tanstack/react-query'

// Create a singleton query client for data caching
let queryClient: QueryClient | null = null

export function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Cache data for 5 minutes
          staleTime: 5 * 60 * 1000,
          // Keep data in cache for 10 minutes
          gcTime: 10 * 60 * 1000,
          // Retry failed requests once
          retry: 1,
          // Refetch on window focus
          refetchOnWindowFocus: false,
        },
      },
    })
  }
  return queryClient
}

// Prefetch project data
export async function prefetchProject(projectId: string) {
  const client = getQueryClient()
  await client.prefetchQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      // This will be implemented in the actual fetch function
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Prefetch tent data
export async function prefetchTent(tentId: string) {
  const client = getQueryClient()
  await client.prefetchQuery({
    queryKey: ['tent', tentId],
    queryFn: async () => {
      const response = await fetch(`/api/tents/${tentId}`)
      if (!response.ok) throw new Error('Failed to fetch tent')
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}