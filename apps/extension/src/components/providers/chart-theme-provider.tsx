'use client'

import type { ITheme } from '@visactor/react-vchart'
import { ThemeManager } from '@visactor/vchart'
import { createContext, use, useEffect, useMemo } from 'react'
import { customDarkTheme, customLightTheme } from '@/utils/config/chart-theme'
import { useTheme } from './theme-provider'

type ChartTheme = 'light' | 'dark'

interface ChartThemeContextI {
  theme: ChartTheme
}

export const ChartThemeContext = createContext<ChartThemeContextI | undefined>(undefined)

export function ChartThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { theme } = useTheme()

  const chartTheme = useMemo<ChartTheme>(() => theme === 'dark' ? 'dark' : 'light', [theme])

  useEffect(() => {
    registerTheme()
  }, [])

  useEffect(() => {
    ThemeManager.setCurrentTheme(chartTheme)
  }, [chartTheme])

  const contextValue = useMemo(() => ({ theme: chartTheme }), [chartTheme])

  return (
    <ChartThemeContext value={contextValue}>
      {children}
    </ChartThemeContext>
  )
}

export function useChartTheme(): ChartThemeContextI {
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
