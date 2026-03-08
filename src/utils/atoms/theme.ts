import type { ThemeMode } from "@/types/config/theme"
import { atom } from "jotai"
import { DEFAULT_THEME_MODE, themeModeSchema } from "@/types/config/theme"
import { THEME_STORAGE_KEY } from "../constants/config"
import { storageAdapter } from "./storage-adapter"

export const themeModeAtom = atom<ThemeMode>(DEFAULT_THEME_MODE)

themeModeAtom.onMount = (setAtom: (newValue: ThemeMode) => void) => {
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

export const writeThemeModeAtom = atom(
  null,
  async (_get, set, mode: ThemeMode) => {
    set(themeModeAtom, mode)
    await storageAdapter.set(THEME_STORAGE_KEY, mode, themeModeSchema)
  },
)
