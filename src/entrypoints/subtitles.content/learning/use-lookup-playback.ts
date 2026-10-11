import { useEffect, useRef } from "react"
import { useSubtitlesUI } from "../ui/subtitles-ui-context"

/**
 * Dismissing the card by pressing on the player, or on another word, closes
 * and (for a word) reopens the lookup within one click. Resuming after this
 * delay lets a reopen cancel the resume, and lets the host player's own
 * click-to-toggle settle first instead of racing it.
 */
const RESUME_DELAY_MS = 200

/**
 * Pauses the video while a word is being looked up and resumes it on close,
 * but only when this hook paused it and the viewer did not press play in
 * between.
 */
export function useLookupPlayback(open: boolean) {
  const { pauseVideo, playVideo, isVideoPaused } = useSubtitlesUI()
  const pausedByLookupRef = useRef(false)
  const pendingResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    if (pendingResumeRef.current !== null) {
      clearTimeout(pendingResumeRef.current)
      pendingResumeRef.current = null
    } else if (!isVideoPaused()) {
      pauseVideo()
      pausedByLookupRef.current = true
    }

    const handlePlay = () => {
      pausedByLookupRef.current = false
    }
    document.addEventListener("play", handlePlay, true)

    return () => {
      document.removeEventListener("play", handlePlay, true)
      if (!pausedByLookupRef.current) {
        return
      }

      pendingResumeRef.current = setTimeout(() => {
        pendingResumeRef.current = null
        pausedByLookupRef.current = false
        if (isVideoPaused()) {
          playVideo()
        }
      }, RESUME_DELAY_MS)
    }
  }, [isVideoPaused, open, pauseVideo, playVideo])
}
