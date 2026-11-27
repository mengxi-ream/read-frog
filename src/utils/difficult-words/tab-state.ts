import type { DifficultWordsSurface, DifficultWordsTabState } from "./types"
import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import { sendMessage } from "@/utils/message"

// The page's marking, shared by the parts of the content runtime that show
// it: the selection UI runs it, the floating button shows and switches it.
// One module instance serves them all (see content-runtime).

type SetEnabled = (enabled: boolean, surface: DifficultWordsSurface | null) => void

let state: DifficultWordsTabState = { enabled: false, count: 0 }
let setEnabledHandler: SetEnabled | null = null
const listeners = new Set<() => void>()

export const difficultWordsTab = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  update: (next: Partial<DifficultWordsTabState>) => {
    const updated = { ...state, ...next }
    if (updated.enabled === state.enabled && updated.count === state.count) return
    state = updated
    for (const listener of listeners) listener()
  },
  /** Installed by what runs the marking; the returned function takes it back. */
  install: (handler: SetEnabled) => {
    setEnabledHandler = handler
    return () => {
      if (setEnabledHandler === handler) setEnabledHandler = null
    }
  },
  /** `surface` is where the reader asked from; `null` when nobody did. */
  setEnabled: (enabled: boolean, surface: DifficultWordsSurface | null) => {
    setEnabledHandler?.(enabled, surface)
  },
}

export function useDifficultWordsTabState(): DifficultWordsTabState {
  return useSyncExternalStore(
    difficultWordsTab.subscribe,
    difficultWordsTab.getState,
    difficultWordsTab.getState,
  )
}

/**
 * Whether this account may use difficult words, asked of the background,
 * which caches the answer for every tab; `fresh` asks the server instead.
 * `enabled: false` while the feature is switched off, so nothing is asked.
 */
export function useDifficultWordsAccess(enabled: boolean, { fresh = false } = {}) {
  return useQuery({
    queryKey: ["difficultWordsAccess", fresh],
    queryFn: () => sendMessage("getDifficultWordsAccess", fresh ? { fresh } : undefined),
    enabled,
    staleTime: 60_000,
    retry: false,
    meta: { suppressToast: true },
  })
}
