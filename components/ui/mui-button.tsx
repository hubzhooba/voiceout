'use client'

import React from 'react'
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material'
import { styled } from '@mui/material/styles'
import { motion } from 'framer-motion'

// Create a styled MUI button with gradient support
const StyledButton = styled(MuiButton)<{ gradient?: boolean }>(({ theme, gradient, variant }) => ({
  borderRadius: 32,
  padding: '10px 24px',
  textTransform: 'none',
  fontWeight: 500,
  transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
  ...(gradient && variant === 'contained' && {
    background: theme.palette.mode === 'light'
      ? 'linear-gradient(90deg, #332B34 0%, #2C3233 49.34%, #4D443A 100%)'
      : 'linear-gradient(90deg, rgb(220,220,220) 0%, rgb(200,200,200) 50%, rgb(240,240,240) 100%)',
    '&:hover': {
      background: theme.palette.mode === 'light'
        ? 'linear-gradient(90deg, #2C3233 0%, #332B34 49.34%, #4D443A 100%)'
        : 'linear-gradient(90deg, rgb(200,200,200) 0%, rgb(220,220,220) 50%, rgb(240,240,240) 100%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
    },
  }),
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
  },
}))

// Motion wrapper for animations
const MotionButton = motion(StyledButton)

export interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'contained' | 'outlined' | 'text' | 'gradient'
  loading?: boolean
  gradient?: boolean
  animate?: boolean
}

export function Button({ 
  children, 
  variant = 'contained',
  loading = false,
  gradient = false,
  animate = true,
  disabled,
  ...props 
}: ButtonProps) {
  // Apply gradient for 'gradient' variant or when gradient prop is true
  const shouldUseGradient = variant === 'gradient' || gradient
  const muiVariant = variant === 'gradient' ? 'contained' : variant

  const buttonProps = {
    ...props,
    variant: muiVariant as MuiButtonProps['variant'],
    gradient: shouldUseGradient,
    disabled: disabled || loading,
  }

  if (animate) {
    return (
      <MotionButton
        {...buttonProps}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          children
        )}
      </MotionButton>
    )
  }

  return (
    <StyledButton {...buttonProps}>
      {loading ? (
        <CircularProgress size={20} color="inherit" />
      ) : (
        children
      )}
    </StyledButton>
  )
}