'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// Configure NProgress
NProgress.configure({ 
  showSpinner: false,
  trickle: true,
  trickleSpeed: 200,
  minimum: 0.2,
  easing: 'ease',
  speed: 300,
})

export function InstantLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // End loading when route changes
    NProgress.done()
    
    // Start loading on link clicks
    const handleStart = () => NProgress.start()
    const handleComplete = () => NProgress.done()
    
    // Listen for route changes
    const links = document.querySelectorAll('a[href^="/"]')
    links.forEach(link => {
      link.addEventListener('click', handleStart)
    })
    
    return () => {
      links.forEach(link => {
        link.removeEventListener('click', handleStart)
      })
      handleComplete()
    }
  }, [pathname, searchParams])

  return <>{children}</>
}

// Add custom styles for the progress bar
export const progressBarStyles = `
  #nprogress {
    pointer-events: none;
  }
  
  #nprogress .bar {
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    position: fixed;
    z-index: 1031;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5), 0 0 5px rgba(139, 92, 246, 0.5);
  }
  
  #nprogress .peg {
    display: block;
    position: absolute;
    right: 0px;
    width: 100px;
    height: 100%;
    box-shadow: 0 0 10px #3b82f6, 0 0 5px #3b82f6;
    opacity: 1.0;
    transform: rotate(3deg) translate(0px, -4px);
  }
`