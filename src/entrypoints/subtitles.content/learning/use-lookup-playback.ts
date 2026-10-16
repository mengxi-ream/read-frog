import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { useSubtitlesUI } from "../ui/subtitles-ui-context"
import { wordLookupAtom } from "./atoms"

const RESUME_AFTER_CLOSE_DELAY_MS = 200

export function useLookupPlayback() {
  const lookup = useAtomValue(wordLookupAtom)
  const open = lookup !== null
  const { getVideoElement } = useSubtitlesUI()
  const pausedByLookupRef = useRef(false)
  const pendingResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const video = getVideoElement()
    if (!lookup || !video || video.paused) {
      return
    }
    video.pause()
    pausedByLookupRef.current = true
  }, [getVideoElement, lookup])

  useEffect(() => {
    const video = getVideoElement()
    if (!open || !video) {
      return undefined
    }

    if (pendingResumeRef.current !== null) {
      clearTimeout(pendingResumeRef.current)
      pendingResumeRef.current = null
      pausedByLookupRef.current = true
    }

    const forgetPause = () => {
      pausedByLookupRef.current = false
    }
    video.addEventListener("play", forgetPause)

    return () => {
      video.removeEventListener("play", forgetPause)
      if (!pausedByLookupRef.current) {
        return
      }

      pausedByLookupRef.current = false
      pendingResumeRef.current = setTimeout(() => {
        pendingResumeRef.current = null
        if (video.paused) {
          void video.play()
        }
      }, RESUME_AFTER_CLOSE_DELAY_MS)
    }
  }, [getVideoElement, open])
}
