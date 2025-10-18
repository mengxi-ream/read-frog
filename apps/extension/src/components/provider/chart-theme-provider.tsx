'use client'

import type { ITheme } from '@visactor/vchart'
import { ThemeManager } from '@visactor/vchart'
import { createContext, use, useEffect } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { customDarkTheme, customLightTheme } from '@/utils/config/chart-theme'

type ChartTheme = 'light' | 'dark' | 'system'

interface ChartThemeContextI {
  theme: ChartTheme | undefined
}

export const ChartThemeContext = createContext<ChartThemeContextI>({
  theme: 'light',
})

export function ChartThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const themeProps = useTheme()

  useEffect(() => {
    registerTheme()
  }, [])

  useEffect(() => {
    const updateTheme = () => {
      ThemeManager.setCurrentTheme(themeProps.theme)
    }

    updateTheme()
  }, [themeProps.theme])

  return (
    <ChartThemeContext value={themeProps}>
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
  const font = '\'Gabarito\', \'Gabarito Fallback\''
  const lightTheme: Partial<ITheme> = {
    ...customLightTheme,
    fontFamily: font,
  }
  const darkTheme: Partial<ITheme> = {
    ...customDarkTheme,
    fontFamily: font,
  }
  ThemeManager.registerTheme('light', lightTheme)
  ThemeManager.registerTheme('dark', darkTheme)
}
