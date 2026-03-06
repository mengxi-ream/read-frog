import type { Theme, ThemeMode } from "@/types/config/theme"
import { useAtomValue, useSetAtom } from "jotai"
import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { themeModeAtom, writeThemeModeAtom } from "@/utils/atoms/theme"

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
  const themeMode = useAtomValue(themeModeAtom)
  const setThemeModeAtom = useSetAtom(writeThemeModeAtom)

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

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      void setThemeModeAtom(mode)
    },
    [setThemeModeAtom],
  )

  // Apply theme to document or shadow root container
  useEffect(() => {
    const target = container ?? document.documentElement
    target.classList.remove("light", "dark")
    target.classList.add(theme)
    target.setAttribute("style", `color-scheme: ${theme}`)
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
