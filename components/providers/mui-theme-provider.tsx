'use client'

import React from 'react'
import { ThemeProvider as MUIThemeProvider, CssBaseline } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { lightTheme, darkTheme } from '@/lib/theme/mui-theme'
import { useTheme } from '@/components/theme-provider'

// Create emotion cache for CSS-in-JS with prepend option
// This ensures MUI styles are injected before Tailwind
const emotionCache = createCache({
  key: 'mui',
  prepend: true,
})

export function MuiProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const muiTheme = theme === 'dark' ? darkTheme : lightTheme

  return (
    <CacheProvider value={emotionCache}>
      <MUIThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </CacheProvider>
  )
}