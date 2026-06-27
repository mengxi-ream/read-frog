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
const SUBTITLE_JSON_HINT_PATTERN = /timedtext|texttrack|transcripts_url|textstream_|captions?|subtitles?|ttDownloadables?|downloadUrls?/i
const SUBTITLE_TRACK_KEY_PATTERN = /timedtext|texttrack|transcript|caption|subtitle|ttDownloadables?/i
const JSON_RESPONSE_URL_PATTERN = /manifest|metadata|pathEvaluator|shakti|cadmium|timedtext|texttrack|caption|subtitle/i
const nativeJSONParse = JSON.parse.bind(JSON)
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
      const lowerKey = key.toLowerCase()
      const isUrlKey = lowerKey.includes("url")
      const isUrlLikeValue = /^(?:https?:)?\/\//i.test(value) || value.startsWith("/")
      const url = (isUrlKey || isUrlLikeValue) ? normalizeUrl(value) : null
      if (url && (looksLikeSubtitleUrl(url) || isUrlKey))
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
      visit(childValue, key ? `${key}.${childKey}` : childKey)
    }
  }

  visit(track)
  return [...urls]
}

function getFirstString(track: any, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = track?.[key]
    if (typeof value === "string" && value.trim())
      return value
  }
}

function normalizeTrack(track: any): StreamingSubtitleTrackMessage[] {
  return findTrackUrls(track).map(url => ({
    url,
    language: getFirstString(track, ["language", "languageCode", "lang", "bcp47", "locale", "languageId"]),
    label: getFirstString(track, ["languageDescription", "displayName", "label", "name", "description"]),
    kind: getFirstString(track, ["trackType", "kind", "type", "role"]),
  }))
}

function hasSubtitleTrackHint(track: any, key = ""): boolean {
  if (SUBTITLE_TRACK_KEY_PATTERN.test(key))
    return true

  if (!track || typeof track !== "object" || Array.isArray(track))
    return false

  return Object.keys(track).some(childKey => SUBTITLE_TRACK_KEY_PATTERN.test(childKey))
}

function hasLanguageMetadata(track: any): boolean {
  return Boolean(getFirstString(track, [
    "language",
    "languageCode",
    "lang",
    "bcp47",
    "locale",
    "languageId",
    "languageDescription",
    "displayName",
    "label",
    "name",
  ]))
}

function looksLikeSubtitleTrackObject(track: any, key = ""): boolean {
  if (!track || typeof track !== "object" || Array.isArray(track))
    return false

  const urls = findTrackUrls(track)
  if (urls.length === 0)
    return false

  const hasSubtitleUrl = urls.some(looksLikeSubtitleUrl)
  return hasSubtitleUrl || (hasSubtitleTrackHint(track, key) && hasLanguageMetadata(track))
}

export function collectStreamingSubtitleTracks(value: unknown): StreamingSubtitleTrackMessage[] {
  const tracks: StreamingSubtitleTrackMessage[] = []
  const seen = new WeakSet<object>()

  const visit = (node: unknown, key = "") => {
    if (!node || typeof node !== "object")
      return

    if (seen.has(node))
      return
    seen.add(node)

    if (Array.isArray(node)) {
      if (SUBTITLE_TRACK_KEY_PATTERN.test(key))
        tracks.push(...node.flatMap(normalizeTrack))

      for (const item of node) {
        visit(item, key)
      }
      return
    }

    if (looksLikeSubtitleTrackObject(node, key))
      tracks.push(...normalizeTrack(node))

    for (const [childKey, childValue] of Object.entries(node)) {
      if (Array.isArray(childValue) && SUBTITLE_TRACK_KEY_PATTERN.test(childKey))
        tracks.push(...childValue.flatMap(normalizeTrack))

      visit(childValue, childKey)
    }
  }

  visit(value)

  const byUrl = new Map<string, StreamingSubtitleTrackMessage>()
  for (const track of tracks) {
    byUrl.set(track.url, track)
  }
  return [...byUrl.values()]
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

function replayCachedTracks() {
  publishTracks([...trackByUrl.values()])
}

function publishTracksFromParsedJSON(value: unknown) {
  publishTracks(collectStreamingSubtitleTracks(value))
}

function publishTracksFromJSONText(text: string | null) {
  if (!text || !SUBTITLE_JSON_HINT_PATTERN.test(text))
    return

  try {
    publishTracksFromParsedJSON(nativeJSONParse(text))
  }
  catch {
    // Ignore non-JSON responses and unrelated page data.
  }
}

function shouldInspectJSONResponse(url: string | null, contentType: string | null): boolean {
  return /\bjson\b/i.test(contentType ?? "") || Boolean(url && JSON_RESPONSE_URL_PATTERN.test(url))
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
    if (typeof text === "string" && !SUBTITLE_JSON_HINT_PATTERN.test(text))
      return result

    try {
      publishTracksFromParsedJSON(result)
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

function getXHRResponseJSON(xhr: XMLHttpRequest): unknown {
  try {
    if (xhr.responseType === "json")
      return xhr.response
  }
  catch {
    return null
  }
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
      const text = getXHRResponseText(this)
      captureSubtitle(url, text)

      if (shouldInspectJSONResponse(normalizeUrl(url), this.getResponseHeader("content-type"))) {
        const json = getXHRResponseJSON(this)
        if (json)
          publishTracksFromParsedJSON(json)
        else
          publishTracksFromJSONText(text)
      }
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
    if (!normalizedUrl)
      return response

    if (looksLikeSubtitleUrl(normalizedUrl)) {
      void response.clone().text().then(text => captureSubtitle(normalizedUrl, text)).catch(() => {})
      return response
    }

    if (shouldInspectJSONResponse(normalizedUrl, response.headers.get("content-type")))
      void response.clone().text().then(publishTracksFromJSONText).catch(() => {})

    return response
  }
}

function ensureNativeSubtitles() {
  replayCachedTracks()

  const player = getNetflixPlayer()
  if (!player)
    return

  const tracks = player.getTimedTextTrackList?.()
  if (!Array.isArray(tracks))
    return

  publishTracks(tracks.flatMap(normalizeTrack))

  const current = player.getTimedTextTrack?.()
  if (isUsableNetflixTrack(current))
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
