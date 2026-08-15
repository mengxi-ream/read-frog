/**
 * Tracks whether the document is currently in fullscreen.
 *
 * Only the fullscreen element's subtree gets painted, so sites that fullscreen
 * the player itself (Bilibili, X) already hide our body-anchored overlays for
 * free. YouTube fullscreens `document.documentElement`, which keeps the whole
 * document painted — this lets those overlays opt out explicitly.
 *
 * @returns Whether a fullscreen element is active
 */

import { useEffect, useState } from "react"

export function useIsFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement))

    // Fullscreen may have been entered between the initial state and this effect
    syncFullscreenState()
    document.addEventListener("fullscreenchange", syncFullscreenState)

    return () => document.removeEventListener("fullscreenchange", syncFullscreenState)
  }, [])

  return isFullscreen
}
