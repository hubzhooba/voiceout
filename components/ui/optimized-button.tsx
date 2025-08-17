'use client'

import React, { useCallback, useState } from 'react'
import { Button, ButtonProps } from './button'

interface OptimizedButtonProps extends ButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
  immediateResponse?: boolean // Show immediate feedback
}

export function OptimizedButton({ 
  onClick, 
  children, 
  disabled,
  immediateResponse = true,
  ...props 
}: OptimizedButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isProcessing || disabled) return
    
    // Prevent multiple clicks
    e.preventDefault()
    e.stopPropagation()
    
    // Immediate visual feedback
    if (immediateResponse) {
      setIsProcessing(true)
    }
    
    try {
      if (onClick) {
        await onClick(e)
      }
    } finally {
      // Reset after operation completes
      setIsProcessing(false)
    }
  }, [onClick, isProcessing, disabled, immediateResponse])

  return (
    <Button
      {...props}
      disabled={disabled || isProcessing}
      onClick={handleClick}
      style={{
        transform: 'translateZ(0)', // Force GPU acceleration
        willChange: 'transform',
      }}
    >
      {isProcessing ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          {children}
        </span>
      ) : (
        children
      )}
    </Button>
  )
}