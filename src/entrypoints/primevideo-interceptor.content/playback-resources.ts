import {
  PRIME_VIDEO_DURATION_TOLERANCE_MS,
  PRIME_VIDEO_PLAYBACK_RESOURCES_URL_PATTERN,
} from "@/utils/constants/subtitles"

/** A title as Prime sent it: its length to find the video by, the rest for the content script. */
export interface PlaybackResources {
  durationMs: number
  timedText: unknown
  playlist: unknown
}

// Latest request last: Prime asks for the next episode ahead, and again when it starts playing it.
const resourcesByTitleId = new Map<string, PlaybackResources>()

export function recordPlaybackResources(titleId: string, value: any): boolean {
  const timedText = value?.timedTextUrls?.result
  const playbackUrls = value?.vodPlaylistedPlaybackUrls?.result?.playbackUrls
  // A trailer's resources come without subtitle urls, so it is never taken for the title.
  if (!timedText || typeof playbackUrls?.fullTitleDurationMs !== "number") return false

  resourcesByTitleId.delete(titleId)
  resourcesByTitleId.set(titleId, {
    durationMs: playbackUrls.fullTitleDurationMs,
    timedText,
    playlist: playbackUrls.intraTitlePlaylist,
  })
  return true
}

/** The title a video this long plays: no url names it, and the page asks for several titles. */
export function findTitleIdByDuration(durationMs: number): string | null {
  let found: string | null = null
  for (const [titleId, resources] of resourcesByTitleId) {
    if (Math.abs(resources.durationMs - durationMs) <= PRIME_VIDEO_DURATION_TOLERANCE_MS) {
      found = titleId
    }
  }
  return found
}

export function findPlaybackResources(titleId: string): PlaybackResources | null {
  return resourcesByTitleId.get(titleId) ?? null
}

export function setupPlaybackResourcesCapture(onRecorded: () => void): void {
  // Observe only: Prime gets its response untouched, and our errors never reach it.
  const originalFetch = window.fetch
  window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    const response = originalFetch.apply(this, args)
    const url = args[0] instanceof Request ? args[0].url : String(args[0])
    const titleId = PRIME_VIDEO_PLAYBACK_RESOURCES_URL_PATTERN.test(url)
      ? new URL(url).searchParams.get("titleId")
      : null
    if (titleId) {
      response
        .then((result) => result.clone().json())
        .then((value) => {
          if (recordPlaybackResources(titleId, value)) onRecorded()
        })
        .catch(() => {})
    }
    return response
  }
}
