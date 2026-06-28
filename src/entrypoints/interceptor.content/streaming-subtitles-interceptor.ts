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
  pagePath?: string
}

declare global {
  interface Window {
    __READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__?: boolean
  }
}

const SUBTITLE_JSON_HINT_PATTERN = /timedtext|texttrack|caption|subtitle|ttDownloadables?|downloadUrls?/i
const SUBTITLE_TRACK_KEY_PATTERN = /timedtext|texttrack|caption|subtitle|ttDownloadables?/i
const JSON_RESPONSE_URL_PATTERN = /manifest|metadata|pathEvaluator|shakti|cadmium|timedtext|texttrack|caption|subtitle/i
const nativeJSONParse = JSON.parse.bind(JSON)
const trackByUrl = new Map<string, StreamingSubtitleTrackMessage>()

function getCurrentPagePath(): string {
  return window.location.pathname
}

export function injectStreamingSubtitlesInterceptor(): void {
  if (window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ || !/(?:^|\.)netflix\.com$/i.test(window.location.hostname))
    return

  window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ = true
  window.addEventListener("message", (event) => {
    if (event.origin === window.location.origin && event.data?.type === STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE)
      postTracks([...trackByUrl.values()].filter(track => track.pagePath === getCurrentPagePath()))
  })
  hookJSONParse()
  hookXHR()
  hookFetch()
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

function getFirstString(track: any, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = track?.[key]
    if (typeof value === "string" && value.trim())
      return value
  }
}

function findTrackUrls(track: any): string[] {
  const urls = new Set<string>()
  const visit = (value: any, key = "") => {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase()
      const url = lowerKey.includes("url") || /^(?:https?:)?\/\//i.test(value) || value.startsWith("/")
        ? normalizeUrl(value)
        : null
      if (url && !/^https:\/\/www\.netflix\.com\/watch\//i.test(url))
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

function normalizeTrack(track: any): StreamingSubtitleTrackMessage[] {
  return findTrackUrls(track).map(url => ({
    url,
    language: getFirstString(track, ["language", "languageCode", "lang", "bcp47", "locale", "languageId"]),
    label: getFirstString(track, ["languageDescription", "displayName", "label", "name", "description"]),
    kind: getFirstString(track, ["trackType", "kind", "type", "role"]),
  }))
}

function hasTrackMetadata(track: any): boolean {
  return Boolean(getFirstString(track, ["language", "languageCode", "lang", "bcp47", "locale", "languageId", "languageDescription", "displayName", "label", "name"]))
}

function isTrackObject(track: unknown): track is Record<string, unknown> {
  return !!track && typeof track === "object" && !Array.isArray(track) && hasTrackMetadata(track) && findTrackUrls(track).length > 0
}

export function collectStreamingSubtitleTracks(value: unknown): StreamingSubtitleTrackMessage[] {
  const tracks: StreamingSubtitleTrackMessage[] = []
  const seen = new WeakSet<object>()

  const visit = (node: unknown, key = "") => {
    if (!node || typeof node !== "object" || seen.has(node))
      return
    seen.add(node)

    if (Array.isArray(node)) {
      if (SUBTITLE_TRACK_KEY_PATTERN.test(key))
        tracks.push(...node.filter(isTrackObject).flatMap(normalizeTrack))
      node.forEach(item => visit(item, key))
      return
    }

    if (SUBTITLE_TRACK_KEY_PATTERN.test(key) && isTrackObject(node))
      tracks.push(...normalizeTrack(node))
    for (const [childKey, childValue] of Object.entries(node)) {
      visit(childValue, childKey)
    }
  }

  visit(value)
  return [...new Map(tracks.map(track => [track.url, track])).values()]
}

function postTracks(tracks: StreamingSubtitleTrackMessage[]) {
  if (tracks.length === 0)
    return
  window.postMessage({ type: STREAMING_SUBTITLE_TRACKS_TYPE, tracks }, window.location.origin)
}

function publishTracks(tracks: StreamingSubtitleTrackMessage[]) {
  const pagePath = getCurrentPagePath()
  const scopedTracks = tracks.map(track => ({ ...track, pagePath }))
  scopedTracks.forEach(track => trackByUrl.set(track.url, track))
  postTracks(scopedTracks)
}

function publishTracksFromJSONText(text: string | null) {
  if (!text || !SUBTITLE_JSON_HINT_PATTERN.test(text))
    return
  try {
    publishTracks(collectStreamingSubtitleTracks(nativeJSONParse(text)))
  }
  catch {
    // Ignore unrelated or partial page JSON.
  }
}

function shouldInspectJSONResponse(url: string | null, contentType: string | null): boolean {
  return /\bjson\b/i.test(contentType ?? "") || Boolean(url && JSON_RESPONSE_URL_PATTERN.test(url))
}

function captureSubtitle(url: string | null, text: string | null) {
  const normalizedUrl = normalizeUrl(url)
  if (!normalizedUrl || !text)
    return
  const track = trackByUrl.get(normalizedUrl)
  if (!track || track.pagePath !== getCurrentPagePath())
    return
  window.postMessage({
    type: STREAMING_SUBTITLE_CAPTURED_TYPE,
    url: normalizedUrl,
    text,
    language: track?.language,
    pagePath: track.pagePath,
  }, window.location.origin)
}

function hookJSONParse() {
  const originalParse = JSON.parse
  JSON.parse = function (text, reviver) {
    const result = originalParse.call(this, text, reviver)
    if (typeof text === "string" && SUBTITLE_JSON_HINT_PATTERN.test(text)) {
      try {
        publishTracks(collectStreamingSubtitleTracks(result))
      }
      catch {}
    }
    return result
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
      const text = this.responseType === "" || this.responseType === "text" ? this.responseText : null
      captureSubtitle(url, text)
      if (shouldInspectJSONResponse(normalizeUrl(url), this.getResponseHeader("content-type")))
        publishTracksFromJSONText(text)
    })
    return originalSend.apply(this, args as any)
  }
}

function hookFetch() {
  const originalFetch = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch.call(this, input, init)
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl)
      return response

    const shouldInspectJSON = shouldInspectJSONResponse(normalizedUrl, response.headers.get("content-type"))
    if (shouldInspectJSON || trackByUrl.has(normalizedUrl)) {
      void response.clone().text().then((text) => {
        captureSubtitle(normalizedUrl, text)
        if (shouldInspectJSON)
          publishTracksFromJSONText(text)
      }).catch(() => {})
    }
    return response
  }
}
