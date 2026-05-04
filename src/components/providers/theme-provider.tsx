import type { Theme, ThemeMode } from "@/types/config/theme"
import { useAtom } from "jotai"
import { createContext, use, useLayoutEffect, useMemo, useSyncExternalStore } from "react"
import { themeModeAtom } from "@/utils/atoms/theme"
import { applyTheme } from "@/utils/theme"

interface ThemeContextI {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextI | undefined>(undefined)

export function ThemeProvider({
  children,
  container,
}: {
  children: React.ReactNode
  container?: HTMLElement
}) {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom)

  const prefersDark = useSyncExternalStore(
    (cb) => {
      const mq = window?.matchMedia?.("(prefers-color-scheme: dark)")
      if (!mq) {
        return () => {}
      }

      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => !!window?.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
  )

  const theme: Theme = themeMode === "system"
    ? (prefersDark ? "dark" : "light")
    : themeMode

  // Apply theme to document or shadow root container
  useLayoutEffect(() => {
    const target = container ?? document.documentElement
    applyTheme(target, theme)
  }, [theme, container])

  const contextValue = useMemo(
    () => ({ theme, themeMode, setThemeMode }),
    [theme, themeMode, setThemeMode],
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
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
