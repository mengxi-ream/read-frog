import type { ThemeMode } from "@/types/config/theme"
import { atom } from "jotai"
import { DEFAULT_THEME_MODE, themeModeSchema } from "@/types/config/theme"
import { THEME_STORAGE_KEY } from "../constants/config"
import { storageAdapter } from "./storage-adapter"

const baseThemeModeAtom = atom<ThemeMode>(DEFAULT_THEME_MODE)

export const themeModeAtom = atom(
  get => get(baseThemeModeAtom),
  async (get, set, newValue: ThemeMode) => {
    const prev = get(baseThemeModeAtom)
    set(baseThemeModeAtom, newValue)
    try {
      await storageAdapter.set(THEME_STORAGE_KEY, newValue, themeModeSchema)
    }
    catch (error) {
      console.error("Failed to set themeMode to storage:", newValue, error)
      set(baseThemeModeAtom, prev)
    }
  },
)

baseThemeModeAtom.onMount = (setAtom: (newValue: ThemeMode) => void) => {
  let didReceiveStorageUpdate = false

  void storageAdapter.get<ThemeMode>(THEME_STORAGE_KEY, DEFAULT_THEME_MODE, themeModeSchema).then((value) => {
    if (!didReceiveStorageUpdate) {
      setAtom(value)
    }
  })

  const unwatch = storageAdapter.watch<ThemeMode>(THEME_STORAGE_KEY, (value) => {
    didReceiveStorageUpdate = true
    setAtom(value)
  })

  // Sync atom state on tab re-focus (React contexts use this atom).
  // Note: syncThemeOnVisibility in theme.ts handles direct DOM updates
  // for non-React wrappers (e.g. host.content) separately.
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void storageAdapter.get<ThemeMode>(THEME_STORAGE_KEY, DEFAULT_THEME_MODE, themeModeSchema).then(setAtom)
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    unwatch()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}
