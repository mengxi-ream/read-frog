import {
  STREAMING_SUBTITLE_CAPTURED_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
} from "@/utils/constants/subtitles"

export interface StreamingSubtitleTrack {
  url: string
  language?: string
  label?: string
  kind?: string
}

export interface StreamingSubtitleCapture {
  url: string
  text: string
  language?: string
}

const tracks = new Map<string, StreamingSubtitleTrack>()
const captures = new Map<string, StreamingSubtitleCapture>()
let listening = false

export function ensureStreamingSubtitleCaptureListener() {
  if (listening)
    return

  listening = true
  window.addEventListener("message", handleMessage)
}

export function clearStreamingSubtitleCaptures() {
  tracks.clear()
  captures.clear()
}

export function getStreamingSubtitleTracks(): StreamingSubtitleTrack[] {
  return [...tracks.values()]
}

export function getStreamingSubtitleCapture(url?: string | null): StreamingSubtitleCapture | null {
  if (url)
    return captures.get(url) ?? null

  return captures.values().next().value ?? null
}

export function waitForStreamingSubtitleCandidate(timeoutMs: number): Promise<boolean> {
  if (tracks.size > 0 || captures.size > 0)
    return Promise.resolve(true)

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    const listener = () => {
      if (tracks.size === 0 && captures.size === 0)
        return

      clearTimeout(timer)
      window.removeEventListener("message", listener)
      resolve(true)
    }

    timer = setTimeout(() => {
      window.removeEventListener("message", listener)
      resolve(tracks.size > 0 || captures.size > 0)
    }, timeoutMs)

    window.addEventListener("message", listener)
  })
}

export function waitForStreamingSubtitleTracks(
  predicate: (tracks: StreamingSubtitleTrack[]) => boolean,
  timeoutMs: number,
): Promise<StreamingSubtitleTrack[]> {
  const existing = getStreamingSubtitleTracks()
  if (predicate(existing))
    return Promise.resolve(existing)

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    const listener = () => {
      const current = getStreamingSubtitleTracks()
      if (!predicate(current))
        return

      clearTimeout(timer)
      window.removeEventListener("message", listener)
      resolve(current)
    }

    timer = setTimeout(() => {
      window.removeEventListener("message", listener)
      resolve(getStreamingSubtitleTracks())
    }, timeoutMs)

    window.addEventListener("message", listener)
  })
}

export function waitForStreamingSubtitleCapture(url: string | null, timeoutMs: number): Promise<StreamingSubtitleCapture | null> {
  const existing = getStreamingSubtitleCapture(url)
  if (existing)
    return Promise.resolve(existing)

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    const listener = () => {
      const capture = getStreamingSubtitleCapture(url)
      if (!capture)
        return

      clearTimeout(timer)
      window.removeEventListener("message", listener)
      resolve(capture)
    }

    timer = setTimeout(() => {
      window.removeEventListener("message", listener)
      resolve(getStreamingSubtitleCapture(url))
    }, timeoutMs)

    window.addEventListener("message", listener)
  })
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin)
    return

  const data = event.data
  if (data?.type === STREAMING_SUBTITLE_TRACKS_TYPE && Array.isArray(data.tracks)) {
    for (const track of data.tracks) {
      if (typeof track?.url === "string") {
        tracks.set(track.url, {
          url: track.url,
          language: typeof track.language === "string" ? track.language : undefined,
          label: typeof track.label === "string" ? track.label : undefined,
          kind: typeof track.kind === "string" ? track.kind : undefined,
        })
      }
    }
  }

  if (data?.type === STREAMING_SUBTITLE_CAPTURED_TYPE
    && typeof data.url === "string"
    && typeof data.text === "string") {
    captures.set(data.url, {
      url: data.url,
      text: data.text,
      language: typeof data.language === "string" ? data.language : undefined,
    })
  }
}
