import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { HOVER_PAUSE_DELAY_MS } from "@/utils/constants/subtitles"
import { useSubtitlesUI } from "../ui/subtitles-ui-context"
import { subtitlesHoveredAtom, wordLookupAtom } from "./atoms"

/**
 * Holds the video while a lookup is open, and, with pause-on-hover on, while
 * the pointer rests on the subtitles; plays it again once neither is true,
 * unless the viewer pressed play in between.
 *
 * The pointer has to rest for HOVER_PAUSE_DELAY_MS before it pauses, so one
 * passing over the subtitles on its way to the player's controls does not.
 */
export function useHoldPlayback() {
  const hovered = useAtomValue(subtitlesHoveredAtom)
  const lookup = useAtomValue(wordLookupAtom)
  const { pauseOnHover } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { getVideoElement } = useSubtitlesUI()
  const pausedByHoldRef = useRef(false)
  const hoverHolds = pauseOnHover && hovered
  const lookingUp = lookup !== null
  const hold = hoverHolds || lookingUp

  // Runs again for each new lookup and each time the pointer comes back, so
  // either pauses the video again after the viewer pressed play.
  useEffect(() => {
    const video = getVideoElement()
    if (!video || (!hoverHolds && !lookup)) {
      return undefined
    }

    const pause = () => {
      if (video.paused) {
        return
      }
      video.pause()
      pausedByHoldRef.current = true
    }

    if (lookup) {
      pause()
      return undefined
    }

    const timer = window.setTimeout(pause, HOVER_PAUSE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [getVideoElement, hoverHolds, lookup])

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
