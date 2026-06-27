import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_SUBTITLE_CAPTURED_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
} from "@/utils/constants/subtitles"

interface StreamingSubtitleTrackMessage {
  url: string
  language?: string
  label?: string
  kind?: string
}

declare global {
  interface Window {
    __READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__?: boolean
    netflix?: any
  }
}

const STREAMING_HOST_PATTERN = /(?:^|\.)(?:(?:netflix|paramountplus|disneyplus)\.com|play\.max\.com|max\.com)$/i
const SUBTITLE_URL_PATTERN = /\.(?:vtt|srt|webvtt|xml|ttml|dfxp)(?:[?#]|$)|timedtext|texttrack|transcripts_url|textstream_|captions?|subtitles?/i
const trackByUrl = new Map<string, StreamingSubtitleTrackMessage>()

export function injectStreamingSubtitlesInterceptor(): void {
  if (window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__)
    return

  if (!STREAMING_HOST_PATTERN.test(window.location.hostname))
    return

  window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ = true
  window.addEventListener("message", handleMessage)
  hookJSONParse()
  hookXHR()
  hookFetch()
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin)
    return

  if (event.data?.type === STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE)
    ensureNativeSubtitles()
}

function postToContent(data: Record<string, unknown>) {
  window.postMessage(data, window.location.origin)
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0)
    return null

  try {
    return new URL(value, window.location.href).href
  }
  catch {
    return null
  }
}

function looksLikeSubtitleUrl(value: string): boolean {
  return SUBTITLE_URL_PATTERN.test(value)
}

function findTrackUrls(track: any): string[] {
  const urls = new Set<string>()
  const visit = (value: any, key = "") => {
    if (typeof value === "string") {
      const url = normalizeUrl(value)
      if (url && (looksLikeSubtitleUrl(url) || key.toLowerCase().includes("url")))
        urls.add(url)
      return
    }

    if (!value || typeof value !== "object")
      return

    if (Array.isArray(value)) {
      value.forEach(item => visit(item, key))
      return
    }

    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, childKey)
    }
  }

  visit(track)
  return [...urls]
}

function normalizeTrack(track: any): StreamingSubtitleTrackMessage[] {
  return findTrackUrls(track).map(url => ({
    url,
    language: track?.language ?? track?.languageCode ?? track?.lang ?? track?.bcp47,
    label: track?.languageDescription ?? track?.label ?? track?.name,
    kind: track?.trackType ?? track?.kind,
  }))
}

function publishTracks(tracks: StreamingSubtitleTrackMessage[]) {
  if (tracks.length === 0)
    return

  for (const track of tracks) {
    trackByUrl.set(track.url, track)
  }

  postToContent({
    type: STREAMING_SUBTITLE_TRACKS_TYPE,
    tracks,
  })
}

function captureSubtitle(url: string | null, text: string | null) {
  if (!url || !text)
    return

  const normalizedUrl = normalizeUrl(url)
  if (!normalizedUrl || !looksLikeSubtitleUrl(normalizedUrl))
    return

  const track = trackByUrl.get(normalizedUrl)
  postToContent({
    type: STREAMING_SUBTITLE_CAPTURED_TYPE,
    url: normalizedUrl,
    text,
    language: track?.language,
  })
}

function hookJSONParse() {
  const originalParse = JSON.parse

  JSON.parse = function (text, reviver) {
    const result = originalParse.call(this, text, reviver)

    try {
      const timedTextTracks = result?.result?.timedtexttracks
      if (Array.isArray(timedTextTracks)) {
        publishTracks(timedTextTracks.flatMap(normalizeTrack))
      }

      const disneyCaptions = result?.asset?.captions
      if (Array.isArray(disneyCaptions)) {
        publishTracks(disneyCaptions.flatMap(normalizeTrack))
      }
    }
    catch {
      // Ignore page JSON that is unrelated to subtitles.
    }

    return result
  }
}

function getXHRResponseText(xhr: XMLHttpRequest): string | null {
  try {
    if (xhr.responseType === "arraybuffer" && xhr.response instanceof ArrayBuffer)
      return new TextDecoder("utf-8").decode(xhr.response)

    if (xhr.responseType === "" || xhr.responseType === "text")
      return xhr.responseText
  }
  catch {
    return null
  }

  return null
}

function hookXHR() {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
    ;(this as any).__readFrogSubtitleUrl = url.toString()
    return originalOpen.apply(this, [method, url, ...args] as any)
  }

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener("load", function () {
      const url = this.responseURL || (this as any).__readFrogSubtitleUrl
      captureSubtitle(url, getXHRResponseText(this))
    })
    return originalSend.apply(this, args as any)
  }
}

function hookFetch() {
  const originalFetch = window.fetch

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch.call(this, input, init)
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl || !looksLikeSubtitleUrl(normalizedUrl))
      return response

    void response.clone().text().then(text => captureSubtitle(normalizedUrl, text)).catch(() => {})

    return response
  }
}

function ensureNativeSubtitles() {
  const player = getNetflixPlayer()
  if (!player)
    return

  const current = player.getTimedTextTrack?.()
  if (isUsableNetflixTrack(current) && isEnglishNetflixTrack(current))
    return

  const tracks = player.getTimedTextTrackList?.()
  if (!Array.isArray(tracks))
    return

  const nextTrack = tracks.find((track: any) => isUsableNetflixTrack(track) && isEnglishNetflixTrack(track))
    ?? tracks.find(isUsableNetflixTrack)
  if (nextTrack)
    player.setTimedTextTrack?.(nextTrack)
}

function getNetflixPlayer(): any | null {
  try {
    const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer
    const sessionId = videoPlayer?.getAllPlayerSessionIds?.()?.[0]
    return sessionId ? videoPlayer.getVideoPlayerBySessionId?.(sessionId) ?? null : null
  }
  catch {
    return null
  }
}

function isUsableNetflixTrack(track: any): boolean {
  return !!track
    && !track.isNoneTrack
    && !track.isForcedNarrative
    && !track.isImageBased
}

function isEnglishNetflixTrack(track: any): boolean {
  return /^en\b/i.test(track?.bcp47 ?? "")
}
