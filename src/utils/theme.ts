import type { Theme, ThemeMode } from "@/types/config/theme"
import { storage } from "#imports"
import { DEFAULT_THEME_MODE } from "@/types/config/theme"
import { THEME_STORAGE_KEY } from "./constants/config"

export function isDarkMode(themeMode: ThemeMode = "system"): boolean {
  if (themeMode === "system") {
    return typeof window !== "undefined"
      && !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
  }
  return themeMode === "dark"
}

export function applyTheme(wrapper: HTMLElement, theme: Theme) {
  wrapper.classList.remove("light", "dark")
  wrapper.classList.add(theme)
  wrapper.style.colorScheme = theme
}

export async function getLocalThemeMode(): Promise<ThemeMode> {
  const themeMode = await storage.getItem<ThemeMode>(`local:${THEME_STORAGE_KEY}`)
  return themeMode ?? DEFAULT_THEME_MODE
}
