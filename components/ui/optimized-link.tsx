'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ComponentProps, useCallback, useRef } from 'react'

interface OptimizedLinkProps extends ComponentProps<typeof Link> {
  prefetchDelay?: number // Delay before prefetching on hover (ms)
}

export function OptimizedLink({ 
  children, 
  href,
  prefetchDelay = 100,
  onMouseEnter,
  ...props 
}: OptimizedLinkProps) {
  const router = useRouter()
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>()
  
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // Clear any existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }
    
    // Prefetch after a short delay to avoid prefetching on quick mouse movements
    prefetchTimeoutRef.current = setTimeout(() => {
      router.prefetch(href.toString())
    }, prefetchDelay)
    
    // Call original onMouseEnter if provided
    if (onMouseEnter) {
      onMouseEnter(e)
    }
  }, [href, router, prefetchDelay, onMouseEnter])
  
  const handleMouseLeave = useCallback(() => {
    // Clear timeout if mouse leaves before prefetch
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }
  }, [])
  
  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Link>
  )
}