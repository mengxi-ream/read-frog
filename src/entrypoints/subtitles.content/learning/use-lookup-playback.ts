import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { useSubtitlesUI } from "../ui/subtitles-ui-context"
import { wordLookupAtom } from "./atoms"

const RESUME_AFTER_CLOSE_DELAY_MS = 200

export function useLookupPlayback() {
  const open = useAtomValue(wordLookupAtom) !== null
  const { getVideoElement } = useSubtitlesUI()
  const pausedByLookupRef = useRef(false)
  const pendingResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const video = getVideoElement()
    if (!open || !video) {
      return undefined
    }

    if (pendingResumeRef.current !== null) {
      clearTimeout(pendingResumeRef.current)
      pendingResumeRef.current = null
    } else if (!video.paused) {
      video.pause()
      pausedByLookupRef.current = true
    }

    const handlePlay = () => {
      pausedByLookupRef.current = false
    }
    video.addEventListener("play", handlePlay)

    return () => {
      video.removeEventListener("play", handlePlay)
      if (!pausedByLookupRef.current) {
        return
      }

      pendingResumeRef.current = setTimeout(() => {
        pendingResumeRef.current = null
        pausedByLookupRef.current = false
        if (video.paused) {
          void video.play()
        }
      }, RESUME_AFTER_CLOSE_DELAY_MS)
    }
  }, [getVideoElement, open])
}
