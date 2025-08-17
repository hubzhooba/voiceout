'use client'

import { useEffect, useCallback } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const isCtrlPressed = shortcut.ctrl ? event.ctrlKey : true
      const isMetaPressed = shortcut.meta ? event.metaKey : true
      const isShiftPressed = shortcut.shift ? event.shiftKey : !shortcut.shift
      const isAltPressed = shortcut.alt ? event.altKey : !shortcut.alt
      
      const isKeyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      
      if (isKeyMatch && isCtrlPressed && isMetaPressed && isShiftPressed && isAltPressed) {
        event.preventDefault()
        shortcut.action()
        break
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Common shortcuts
export const commonShortcuts = {
  search: { key: 'k', meta: true, description: 'Open search' },
  newInvoice: { key: 'i', meta: true, description: 'Create new invoice' },
  newTent: { key: 't', meta: true, description: 'Create new tent' },
  notifications: { key: 'n', meta: true, description: 'Open notifications' },
  settings: { key: ',', meta: true, description: 'Open settings' },
  help: { key: '?', shift: true, description: 'Show help' },
  escape: { key: 'Escape', description: 'Close dialog/modal' },
}