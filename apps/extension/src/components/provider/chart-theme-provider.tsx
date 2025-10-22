'use client'

import type { ITheme } from '@visactor/react-vchart'
import { ThemeManager } from '@visactor/vchart'
import { createContext, use, useEffect } from 'react'
import { customDarkTheme, customLightTheme } from '@/utils/config/chart-theme'

type ChartTheme = 'light' | 'dark'

interface ChartThemeContextI {
  theme: ChartTheme
}

export const ChartThemeContext = createContext<ChartThemeContextI>({ theme: 'light' })

function getCurrentTheme() {
  if (
    typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  else {
    return 'light'
  }
}

export function ChartThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    registerTheme()
  }, [])

  const theme = getCurrentTheme()

  useEffect(() => {
    ThemeManager.setCurrentTheme(theme)
  }, [theme])

  return (
    <ChartThemeContext value={{ theme }}>
      {children}
    </ChartThemeContext>
  )
}

export function useChartTheme() {
  const context = use(ChartThemeContext)
  if (!context) {
    throw new Error('useChartTheme must be used within a ChartThemeProvider')
  }
  return context
}

function registerTheme() {
  const lightTheme: Partial<ITheme> = {
    ...customLightTheme,
  }
  const darkTheme: Partial<ITheme> = {
    ...customDarkTheme,
  }
  ThemeManager.registerTheme('light', lightTheme)
  ThemeManager.registerTheme('dark', darkTheme)
}
