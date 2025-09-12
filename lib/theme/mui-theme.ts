'use client'

import { createTheme, responsiveFontSizes } from '@mui/material/styles'

// Custom color palette based on design principles
const lightPalette = {
  primary: {
    main: '#332B34', // Dark purple-gray
    light: '#4D443A',
    dark: '#2C3233',
    contrastText: '#ffffff',
  },
  secondary: {
    main: 'rgb(230, 230, 230)',
    light: 'rgb(240, 240, 240)',
    dark: 'rgb(200, 200, 200)',
    contrastText: '#332B34',
  },
  accent: {
    main: 'rgba(41, 204, 0, 1)', // Green accent
    light: 'rgba(41, 204, 0, 0.8)',
    dark: 'rgba(31, 154, 0, 1)',
    contrastText: '#ffffff',
  },
  background: {
    default: '#ffffff',
    paper: 'rgba(255, 255, 255, 0.8)', // Glass morphism
  },
  text: {
    primary: '#332B34',
    secondary: 'rgba(51, 43, 52, 0.7)',
  },
  divider: 'rgba(0, 0, 0, 0.08)',
}

const darkPalette = {
  primary: {
    main: 'rgb(220, 220, 220)',
    light: 'rgb(240, 240, 240)',
    dark: 'rgb(200, 200, 200)',
    contrastText: '#000000',
  },
  secondary: {
    main: '#332B34',
    light: '#4D443A',
    dark: '#2C3233',
    contrastText: '#ffffff',
  },
  accent: {
    main: 'rgba(41, 204, 0, 1)', // Green accent stays the same
    light: 'rgba(41, 204, 0, 0.8)',
    dark: 'rgba(31, 154, 0, 1)',
    contrastText: '#ffffff',
  },
  background: {
    default: '#0a0a0a',
    paper: 'rgba(20, 20, 20, 0.8)', // Glass morphism for dark
  },
  text: {
    primary: 'rgb(220, 220, 220)',
    secondary: 'rgba(220, 220, 220, 0.7)',
  },
  divider: 'rgba(255, 255, 255, 0.08)',
}

// Create base theme
const createBaseTheme = (mode: 'light' | 'dark') => {
  const palette = mode === 'light' ? lightPalette : darkPalette
  
  return createTheme({
    palette: {
      mode,
      ...palette,
    },
    typography: {
      fontFamily: '"Roboto", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: '3rem',
        lineHeight: 1.2,
      },
      h2: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: '2.25rem',
        lineHeight: 1.3,
      },
      h3: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: '1.875rem',
        lineHeight: 1.4,
      },
      h4: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: '1.5rem',
        lineHeight: 1.4,
      },
      h5: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: '1.25rem',
        lineHeight: 1.5,
      },
      h6: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 500,
        fontSize: '1.125rem',
        lineHeight: 1.5,
      },
      body1: {
        fontFamily: '"Roboto", sans-serif',
        fontWeight: 400,
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontFamily: '"Roboto", sans-serif',
        fontWeight: 400,
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      button: {
        fontFamily: '"Roboto", sans-serif',
        fontWeight: 500,
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: 8, // Default border radius
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 900,
        lg: 1200,
        xl: 1360,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 32,
            padding: '10px 24px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
            },
          },
          containedPrimary: {
            background: mode === 'light' 
              ? 'linear-gradient(90deg, #332B34 0%, #2C3233 49.34%, #4D443A 100%)'
              : 'linear-gradient(90deg, rgb(220,220,220) 0%, rgb(200,200,200) 50%, rgb(240,240,240) 100%)',
            '&:hover': {
              background: mode === 'light'
                ? 'linear-gradient(90deg, #2C3233 0%, #332B34 49.34%, #4D443A 100%)'
                : 'linear-gradient(90deg, rgb(200,200,200) 0%, rgb(220,220,220) 50%, rgb(240,240,240) 100%)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 5,
            backdropFilter: 'blur(10px)',
            backgroundColor: mode === 'light' 
              ? 'rgba(255, 255, 255, 0.7)'
              : 'rgba(20, 20, 20, 0.7)',
            border: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'}`,
          },
          outlined: {
            backgroundColor: 'transparent',
            backdropFilter: 'blur(10px)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 5,
            backdropFilter: 'blur(10px)',
            backgroundColor: mode === 'light' 
              ? 'rgba(255, 255, 255, 0.7)'
              : 'rgba(20, 20, 20, 0.7)',
            border: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'}`,
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(10px)',
            backgroundColor: mode === 'light' 
              ? 'rgba(255, 255, 255, 0.8)'
              : 'rgba(20, 20, 20, 0.8)',
            borderBottom: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'}`,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              '&.Mui-focused fieldset': {
                borderColor: palette.accent.main,
              },
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: palette.accent.main,
            height: 3,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
    },
  })
}

// Create and export responsive themes
export const lightTheme = responsiveFontSizes(createBaseTheme('light'))
export const darkTheme = responsiveFontSizes(createBaseTheme('dark'))

// Animation variants for Framer Motion
export const animationVariants = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.8, 0.25, 1],
      },
    },
  },
  page: {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.8, 0.25, 1],
      },
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: {
        duration: 0.3,
      },
    },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.6 },
    },
  },
  slideUp: {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.8, 0.25, 1],
      },
    },
  },
}

// Custom gradient styles
export const gradients = {
  primary: 'linear-gradient(90deg, #332B34 0%, #2C3233 49.34%, #4D443A 100%)',
  primaryReverse: 'linear-gradient(90deg, #4D443A 0%, #2C3233 49.34%, #332B34 100%)',
  accent: 'linear-gradient(135deg, rgba(41, 204, 0, 0.1) 0%, rgba(41, 204, 0, 0) 100%)',
  glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%)',
  darkGlass: 'linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 100%)',
}

// Glass morphism styles
export const glassMorphism = {
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
  },
  dark: {
    background: 'rgba(20, 20, 20, 0.7)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
}