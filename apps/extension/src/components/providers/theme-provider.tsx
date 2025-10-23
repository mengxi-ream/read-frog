'use client'

import { createContext, use, useEffect, useMemo, useState } from 'react'
import { isDarkMode } from '@/utils/theme'

export type Theme = 'light' | 'dark'

interface ThemeContextI {
  theme: Theme
}

export const ThemeContext = createContext<ThemeContextI | null>(null)

function getCurrentTheme(): Theme {
  return isDarkMode() ? 'dark' : 'light'
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState<Theme>(() => getCurrentTheme())

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq)
      return
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const contextValue = useMemo(() => ({ theme }), [theme])

  return (
    <ThemeContext value={contextValue}>
      {children}
    </ThemeContext>
  )
}

export function useTheme(): ThemeContextI {
  const context = use(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
