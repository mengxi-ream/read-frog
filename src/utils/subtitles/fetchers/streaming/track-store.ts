import type { StreamingTrack } from "./streaming-fetcher"
import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
  STREAMING_SUBTITLE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"

const tracksByKey = new Map<string, StreamingTrack>()
const trackWaiters = new Set<() => void>()

function getCurrentPagePath(): string {
  return window.location.pathname
}

function getTrackKey(track: StreamingTrack): string {
  return track.id ?? track.url ?? track.label ?? track.language ?? ""
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin)
      return
    if (event.data?.type === STREAMING_SUBTITLE_TRACKS_TYPE && Array.isArray(event.data.tracks)) {
      event.data.tracks.forEach((track: StreamingTrack) => {
        const key = getTrackKey(track)
        if (key)
          tracksByKey.set(key, { ...track, pagePath: track.pagePath ?? getCurrentPagePath() })
      })
      trackWaiters.forEach(resolve => resolve())
      trackWaiters.clear()
    }
  })
}

export function getCurrentStreamingTracks(): StreamingTrack[] {
  const pagePath = getCurrentPagePath()
  return [...tracksByKey.values()].filter(track => track.pagePath === pagePath)
}

export async function waitForStreamingTracks(timeoutMs = STREAMING_SUBTITLE_WAIT_TIMEOUT_MS): Promise<StreamingTrack[]> {
  window.postMessage({ type: STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE }, window.location.origin)
  const current = getCurrentStreamingTracks()
  if (current.length > 0)
    return current

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    trackWaiters.add(() => {
      clearTimeout(timer)
      resolve()
    })
  })
  return getCurrentStreamingTracks()
}

export function clearTrackStore(): void {
  tracksByKey.clear()
  trackWaiters.forEach(resolve => resolve())
  trackWaiters.clear()
}
