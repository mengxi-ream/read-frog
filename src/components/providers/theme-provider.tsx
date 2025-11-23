import type { ThemeMode } from '@/utils/atoms/theme'
import { useAtom } from 'jotai'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { getSystemTheme, themeModeAtom, writeThemeModeAtom } from '@/utils/atoms/theme'

export type Theme = 'light' | 'dark'

interface ThemeContextI {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => Promise<void>
}

export const ThemeContext = createContext<ThemeContextI | undefined>(undefined)

export function ThemeProvider({
  children,
  container,
}: {
  children: React.ReactNode
  container?: HTMLElement
}) {
  const [themeMode] = useAtom(themeModeAtom)
  const [, writeThemeMode] = useAtom(writeThemeModeAtom)

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme())

  const theme = useMemo(() => {
    if (themeMode === 'system') {
      return systemTheme
    }
    return themeMode
  }, [themeMode, systemTheme])

  const updateThemeMode = useCallback(
    async (mode: ThemeMode) => {
      await writeThemeMode(mode)
    },
    [writeThemeMode],
  )

  // Apply theme to document or shadow root container
  useEffect(() => {
    const target = container ?? document.documentElement
    target.classList.remove('light', 'dark')
    target.classList.add(theme)
    target.setAttribute('style', `color-scheme: ${theme}`)
  }, [theme, container])

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq)
      return

    const onChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light'
      setSystemTheme(newSystemTheme)
    }

    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const contextValue = useMemo(
    () => ({ theme, themeMode, setThemeMode: updateThemeMode }),
    [theme, themeMode, updateThemeMode],
  )

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
