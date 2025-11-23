import { storage } from '#imports'
import { THEME_MODE_KEY } from './constants/storage-keys'

export type ThemeMode = 'light' | 'dark' | 'system'

let cachedThemeMode: ThemeMode = 'system'
let isInitialized = false

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export async function initThemeManager(): Promise<void> {
  if (isInitialized)
    return

  try {
    const stored = await storage.getItem<ThemeMode>(`local:${THEME_MODE_KEY}`)
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      cachedThemeMode = stored
    }
  }
  catch (error) {
    console.error('Failed to load theme from storage:', error)
  }

  isInitialized = true

  storage.watch<ThemeMode>(`local:${THEME_MODE_KEY}`, (newValue) => {
    if (newValue && ['light', 'dark', 'system'].includes(newValue)) {
      cachedThemeMode = newValue
      window.dispatchEvent(new CustomEvent('themechange', { detail: newValue }))
    }
  })
}

export function getThemeMode(): ThemeMode {
  return cachedThemeMode
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  cachedThemeMode = mode
  await storage.setItem(`local:${THEME_MODE_KEY}`, mode)
  window.dispatchEvent(new CustomEvent('themechange', { detail: mode }))
}

export function getResolvedTheme(): 'light' | 'dark' {
  if (cachedThemeMode === 'system') {
    return getSystemTheme()
  }
  return cachedThemeMode
}

export function isDarkMode(): boolean {
  return getResolvedTheme() === 'dark'
}
