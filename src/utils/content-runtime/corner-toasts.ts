import { useEffect, useSyncExternalStore } from "react"

// The content runtime's parts share one module instance, so one corner
// `toastManager`, and each ToastProvider on it would render every corner toast.
// The selection UI renders them in the frames it runs in; the subtitles render
// them in a frame it doesn't run in, such as an embedded video player's.

let surfaceCount = 0
const listeners = new Set<() => void>()

function setSurfaceCount(count: number) {
  surfaceCount = count
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function hasSurface() {
  return surfaceCount > 0
}

/** Renders this frame's corner toasts in the calling UI for as long as it is mounted. */
export function useCornerToastSurface() {
  useEffect(() => {
    setSurfaceCount(surfaceCount + 1)
    return () => setSurfaceCount(surfaceCount - 1)
  }, [])
}

/** Whether a UI in this frame renders the corner toasts already. */
export function useHasCornerToastSurface(): boolean {
  return useSyncExternalStore(subscribe, hasSurface, hasSurface)
}
