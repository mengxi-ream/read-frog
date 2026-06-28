import type { StreamingSiteAdapter } from "./streaming/streaming-fetcher"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { STREAMING_LIVE_CAPTURE_CUE_TYPE, STREAMING_LIVE_CAPTURE_START_TYPE, STREAMING_LIVE_CAPTURE_STOP_TYPE } from "@/utils/constants/subtitles"
import { parseSubtitleText } from "./streaming/cue-parser"
import { clearTrackStore, getCurrentNetworkTracks, resolveTrackText, waitForNetworkTracks } from "./streaming/track-store"

const NETFLIX_PLAYER_TRACK_KIND = "netflix-player"
let stopLiveCapture: (() => void) | null = null

export const netflixSiteAdapter: StreamingSiteAdapter = {
  id: "netflix",
  matches: url => /(?:^|\.)netflix\.com$/i.test(url.hostname),
  discoverTracks: discoverNetflixTracks,
  fetchTrack: async (track) => {
    if (track.kind?.startsWith(NETFLIX_PLAYER_TRACK_KIND))
      return []
    try {
      return parseSubtitleText(await resolveTrackText(track))
    }
    catch {
      return []
    }
  },
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
  const current = getCurrentNetworkTracks()
  if (current.length > 0)
    return current

  const networkTracks = await Promise.race([
    waitForNetworkTracks(),
    delay(1_500).then(() => []),
  ])
  if (networkTracks.length > 0)
    return networkTracks

  return []
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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
