import { atom } from 'jotai'
import { z } from 'zod'
import { THEME_MODE_KEY } from '../constants/storage-keys'
import { storageAdapter } from './storage-adapter'

export type ThemeMode = 'light' | 'dark' | 'system'

const themeModeSchema = z.enum(['light', 'dark', 'system'])

const DEFAULT_THEME_MODE: ThemeMode = 'system'

export const themeModeAtom = atom<ThemeMode>(DEFAULT_THEME_MODE)

export const writeThemeModeAtom = atom(
  null,
  async (get, set, newMode: ThemeMode) => {
    const modeInStorage = await storageAdapter.get<ThemeMode>(
      THEME_MODE_KEY,
      DEFAULT_THEME_MODE,
      themeModeSchema,
    )
    set(themeModeAtom, modeInStorage)

    const prev = get(themeModeAtom)
    set(themeModeAtom, newMode)

    try {
      await storageAdapter.set(THEME_MODE_KEY, newMode, themeModeSchema)
    }
    catch {
      set(themeModeAtom, prev)
    }
  },
)

themeModeAtom.onMount = (setAtom: (newValue: ThemeMode) => void) => {
  void storageAdapter
    .get<ThemeMode>(THEME_MODE_KEY, DEFAULT_THEME_MODE, themeModeSchema)
    .then(setAtom)

  const unwatch = storageAdapter.watch<ThemeMode>(THEME_MODE_KEY, setAtom)

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void storageAdapter
        .get<ThemeMode>(THEME_MODE_KEY, DEFAULT_THEME_MODE, themeModeSchema)
        .then(setAtom)
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    unwatch()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function getResolvedTheme(themeMode: ThemeMode): 'light' | 'dark' {
  if (themeMode === 'system') {
    return getSystemTheme()
  }
  return themeMode
}

export async function getResolvedThemeFromStorage(): Promise<'light' | 'dark'> {
  const themeMode = await storageAdapter.get<ThemeMode>(
    THEME_MODE_KEY,
    DEFAULT_THEME_MODE,
    themeModeSchema,
  )
  return getResolvedTheme(themeMode)
}
