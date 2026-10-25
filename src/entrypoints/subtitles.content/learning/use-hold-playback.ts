import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { useSubtitlesUI } from "../ui/subtitles-ui-context"
import { subtitlesHeldAtom, subtitlesHoveredAtom, wordLookupAtom } from "./atoms"

/**
 * Holds the video while the pointer is on the subtitles or a lookup is open,
 * and plays it again once neither is true, unless the viewer pressed play in
 * between.
 */
export function useHoldPlayback() {
  const hovered = useAtomValue(subtitlesHoveredAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const hold = useAtomValue(subtitlesHeldAtom)
  const { getVideoElement } = useSubtitlesUI()
  const pausedByHoldRef = useRef(false)

  // Runs again for each new lookup and each time the pointer comes back, so
  // either pauses the video again after the viewer pressed play.
  useEffect(() => {
    const video = getVideoElement()
    if ((!hovered && !lookup) || !video || video.paused) {
      return
    }
    video.pause()
    pausedByHoldRef.current = true
  }, [getVideoElement, hovered, lookup])

  useEffect(() => {
    const video = getVideoElement()
    if (!hold || !video) {
      return undefined
    }

    const forgetPause = () => {
      pausedByHoldRef.current = false
    }
    video.addEventListener("play", forgetPause)

    return () => {
      video.removeEventListener("play", forgetPause)
      if (pausedByHoldRef.current) {
        pausedByHoldRef.current = false
        void video.play()
      }
    }
  }, [getVideoElement, hold])
}
