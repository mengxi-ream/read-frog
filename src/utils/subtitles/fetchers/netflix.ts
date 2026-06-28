import type { StreamingSiteAdapter } from "./streaming/streaming-fetcher"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { STREAMING_LIVE_CAPTURE_CUE_TYPE, STREAMING_LIVE_CAPTURE_START_TYPE, STREAMING_LIVE_CAPTURE_STOP_TYPE } from "@/utils/constants/subtitles"
import { clearTrackStore, getCurrentStreamingTracks, waitForStreamingTracks } from "./streaming/track-store"

let stopLiveCapture: (() => void) | null = null

export const netflixSiteAdapter: StreamingSiteAdapter = {
  id: "netflix",
  matches: url => /(?:^|\.)netflix\.com$/i.test(url.hostname),
  discoverTracks: discoverNetflixTracks,
  fetchTrack: async () => [],
  startLiveCapture: (onFragments) => {
    stopLiveCapture?.()
    const stop = startNetflixDomCapture(onFragments)
    stopLiveCapture = stop ?? null
    return stop
  },
  cleanup: () => {
    stopLiveCapture?.()
    stopLiveCapture = null
    clearTrackStore()
  },
}

async function discoverNetflixTracks() {
  const current = getCurrentStreamingTracks()
  if (current.length > 0)
    return current

  return waitForStreamingTracks(1_500)
}

function startNetflixDomCapture(onFragments: (fragments: SubtitlesFragment[]) => void) {
  const handleCue = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== STREAMING_LIVE_CAPTURE_CUE_TYPE)
      return
    const fragments = event.data.fragments
    if (Array.isArray(fragments))
      onFragments(fragments)
  }
  window.addEventListener("message", handleCue)
  window.postMessage({ type: STREAMING_LIVE_CAPTURE_START_TYPE }, window.location.origin)
  return () => {
    window.removeEventListener("message", handleCue)
    window.postMessage({ type: STREAMING_LIVE_CAPTURE_STOP_TYPE }, window.location.origin)
  }
}
