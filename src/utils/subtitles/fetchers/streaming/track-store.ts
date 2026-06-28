import type { StreamingTrack } from "./streaming-fetcher"
import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_SUBTITLE_CAPTURED_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
  STREAMING_SUBTITLE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { backgroundFetch } from "@/utils/content-script/background-fetch-client"

// Shared store for subtitle tracks/text published by the MAIN-world interceptor
// (Netflix manifest tracks, HBO Max .vtt captures). Page-path scoped so stale
// tracks from a previous title are ignored.

interface StreamingCapture {
  text: string
  pagePath: string
}

const tracksByKey = new Map<string, StreamingTrack>()
const capturesByUrl = new Map<string, StreamingCapture>()
const trackWaiters = new Set<() => void>()

function getCurrentPagePath(): string {
  return window.location.pathname
}

function getTrackKey(track: StreamingTrack): string {
  return track.id ?? track.url ?? track.urls?.join("\n") ?? track.label ?? track.language ?? ""
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
    if (event.data?.type === STREAMING_SUBTITLE_CAPTURED_TYPE && event.data.url && event.data.text) {
      capturesByUrl.set(event.data.url, {
        text: event.data.text,
        pagePath: event.data.pagePath ?? getCurrentPagePath(),
      })
    }
  })
}

export function getCurrentNetworkTracks(): StreamingTrack[] {
  const pagePath = getCurrentPagePath()
  return [...tracksByKey.values()].filter(track => track.pagePath === pagePath)
}

export async function waitForNetworkTracks(): Promise<StreamingTrack[]> {
  window.postMessage({ type: STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE }, window.location.origin)
  const current = getCurrentNetworkTracks()
  if (current.length > 0)
    return current

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, STREAMING_SUBTITLE_WAIT_TIMEOUT_MS)
    trackWaiters.add(() => {
      clearTimeout(timer)
      resolve()
    })
  })
  return getCurrentNetworkTracks()
}

export async function resolveTrackText(track: StreamingTrack): Promise<string> {
  return (await resolveTrackTexts(track)).join("\n\n")
}

export async function resolveTrackTexts(track: StreamingTrack): Promise<string[]> {
  const urls = track.urls?.length ? track.urls : track.url ? [track.url] : []
  if (urls.length === 0)
    throw new Error("Streaming subtitle track has no URL")

  const texts: string[] = []
  for (const url of urls) {
    const captured = capturesByUrl.get(url)
    if (captured?.pagePath === getCurrentPagePath()) {
      texts.push(captured.text)
      continue
    }

    const response = await backgroundFetch(url, undefined, { credentials: "include" })
    if (!response.ok)
      throw new Error(`Failed to fetch streaming subtitle track: ${response.status}`)
    texts.push(await response.text())
  }

  return texts
}

export function clearTrackStore(): void {
  tracksByKey.clear()
  capturesByUrl.clear()
  trackWaiters.forEach(resolve => resolve())
  trackWaiters.clear()
}
