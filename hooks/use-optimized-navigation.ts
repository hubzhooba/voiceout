'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export function useOptimizedNavigation() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback((href: string) => {
    // Use startTransition for non-blocking navigation
    startTransition(() => {
      router.push(href)
    })
  }, [router])

  const prefetch = useCallback((href: string) => {
    router.prefetch(href)
  }, [router])

  return {
    navigate,
    prefetch,
    isPending
  }
}