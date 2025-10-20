import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/**
 * Hook to get the current theme
 * @returns The current theme ('light' or 'dark')
 */
export function useTheme(): { theme: Theme, setTheme: (theme: Theme) => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initial theme detection
    if (localStorage.theme === 'dark') {
      return 'dark'
    }
    if (localStorage.theme === 'light') {
      return 'light'
    }
    // Check system preference
    if (
      typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    // Function to update theme based on current state
    const updateTheme = () => {
      if (localStorage.theme === 'dark') {
        setTheme('dark')
      }
      else if (localStorage.theme === 'light') {
        setTheme('light')
      }
      else {
        // No explicit theme set, use system preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setTheme(isDark ? 'dark' : 'light')
      }
    }
    // Listen to system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => {
      // Only update if no explicit theme is set
      if (!('theme' in localStorage)) {
        updateTheme()
      }
    }

    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  return {
    theme,
    setTheme,
  }
}
