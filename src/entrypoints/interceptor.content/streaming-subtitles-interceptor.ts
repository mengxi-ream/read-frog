import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_LIVE_CAPTURE_CUE_TYPE,
  STREAMING_LIVE_CAPTURE_START_TYPE,
  STREAMING_LIVE_CAPTURE_STOP_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
} from "@/utils/constants/subtitles"

interface InterceptedTrack {
  id?: string
  url?: string
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

const NETFLIX_HOST = /(?:^|\.)netflix\.com$/i
const JSON_URL = /manifest|pathevaluator|metadata|timedtext|\.json/i
const NETFLIX_PLAYER_TRACK_KIND = "netflix-player"
const NETFLIX_CAPTION_SELECTOR = ".player-timedtext-text-container, [data-uia='player-timedtext'], .player-timedtext"
const nativeParse = JSON.parse.bind(JSON)
const tracksByKey = new Map<string, InterceptedTrack>()
const replayedUrls = new Set<string>()
let stopNetflixLiveCapture: (() => void) | null = null

function pagePath(): string {
  return window.location.pathname
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value)
    return null
  try {
    return new URL(value, window.location.href).href
  }
  catch {
    return null
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function trackKey(track: InterceptedTrack): string {
  return track.id ?? track.url ?? track.label ?? track.language ?? ""
}

export function collectStreamingSubtitleTracks(json: unknown): InterceptedTrack[] {
  const tracks: InterceptedTrack[] = []
  const seen = new WeakSet<object>()
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node))
      return
    seen.add(node)
    const record = node as Record<string, unknown>
    if (Array.isArray(record.timedtexttracks)) {
      for (const track of record.timedtexttracks as Record<string, unknown>[]) {
        for (const url of ttDownloadableUrls(track))
          tracks.push({ url, language: str(track.language), label: str(track.languageDescription), kind: str(track.trackType) })
      }
    }
    Object.values(record).forEach(visit)
  }
  visit(json)
  return [...new Map(tracks.map(track => [track.url, track])).values()]
}

function ttDownloadableUrls(track: Record<string, unknown>): string[] {
  const downloadables = track.ttDownloadables
  if (!downloadables || typeof downloadables !== "object")
    return []
  const urls: string[] = []
  for (const profile of Object.values(downloadables)) {
    const downloadUrls = (profile as Record<string, unknown>)?.downloadUrls
    if (downloadUrls && typeof downloadUrls === "object") {
      for (const value of Object.values(downloadUrls)) {
        const url = normalizeUrl(value)
        if (url)
          urls.push(url)
      }
    }
  }
  return urls
}

function postTracks(tracks: InterceptedTrack[]) {
  const byKey = new Map<string, InterceptedTrack>()
  tracks.forEach((track) => {
    const key = trackKey(track)
    if (key)
      byKey.set(key, track)
  })
  const unique = [...byKey.values()]
  if (unique.length)
    window.postMessage({ type: STREAMING_SUBTITLE_TRACKS_TYPE, tracks: unique }, window.location.origin)
}

function publishTracks(tracks: InterceptedTrack[]) {
  const scoped = tracks.map(track => ({ ...track, pagePath: pagePath() }))
  scoped.forEach((track) => {
    const key = trackKey(track)
    if (key)
      tracksByKey.set(key, track)
  })
  postTracks(scoped)
}

function publishFromJson(text: string | null) {
  if (!text || !/timedtext|ttDownloadables/i.test(text))
    return
  try {
    publishTracks(collectStreamingSubtitleTracks(nativeParse(text)))
  }
  catch {
    // Ignore unrelated or partial page JSON.
  }
}

function replayKnownResources() {
  const entries = typeof performance?.getEntriesByType === "function" ? performance.getEntriesByType("resource") : []
  entries
    .map(entry => normalizeUrl(entry.name))
    .filter((url): url is string => !!url && !replayedUrls.has(url) && JSON_URL.test(url))
    .slice(-20)
    .forEach((url) => {
      replayedUrls.add(url)
      void window.fetch(url, { credentials: "include" }).catch(() => {})
    })
}

function inspectJson(rawUrl: string | null, text: string | null, contentType: string | null) {
  const url = normalizeUrl(rawUrl)
  if (url && (/\bjson\b/i.test(contentType ?? "") || JSON_URL.test(url)))
    publishFromJson(text)
}

function getNetflixPlayer(): any {
  const videoPlayer = (window as any).netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer
  const sessionId = videoPlayer?.getAllPlayerSessionIds?.()[0]
  return sessionId ? videoPlayer.getVideoPlayerBySessionId(sessionId) : null
}

function netflixPlayerTracks(): InterceptedTrack[] {
  const tracks = getNetflixPlayer()?.getTimedTextTrackList?.() ?? []
  return tracks
    .filter((track: any) => !track.isNoneTrack)
    .map((track: any) => ({
      id: track.trackId,
      language: track.bcp47,
      label: track.displayName,
      kind: `${NETFLIX_PLAYER_TRACK_KIND} ${track.rawTrackType ?? ""} ${track.trackType ?? ""}`,
      pagePath: pagePath(),
    }))
}

function getNetflixSourceTrack(): any {
  const tracks = getNetflixPlayer()?.getTimedTextTrackList?.() ?? []
  return tracks.find((track: any) => track.bcp47 === "en" && /caption|assistive/i.test(`${track.rawTrackType ?? ""} ${track.trackType ?? ""}`))
    ?? tracks.find((track: any) => track.bcp47 === "en" && !track.isNoneTrack)
    ?? tracks.find((track: any) => !track.isNoneTrack)
}

function readNativeCaptionText(): string {
  const seen = new Set<string>()
  return [...document.querySelectorAll(NETFLIX_CAPTION_SELECTOR)]
    .map(node => node.textContent?.trim() ?? "")
    .filter(text => text && !seen.has(text) && seen.add(text))
    .join("\n")
}

function currentVideoTimeMs(): number {
  const video = document.querySelector("video") as HTMLVideoElement | null
  return Math.round((video?.currentTime ?? 0) * 1000)
}

function startNetflixLiveCapture() {
  const player = getNetflixPlayer()
  const track = getNetflixSourceTrack()
  if (!player || !track)
    return null

  const previous = player.getTimedTextTrack?.()
  player.setTimedTextTrack(track)
  let active: { text: string, start: number, end: number } | null = null
  const emit = () => {
    const text = readNativeCaptionText()
    const now = currentVideoTimeMs()
    if (!text) {
      if (active)
        postLiveCue([{ ...active, end: Math.max(active.start + 250, now) }])
      active = null
      return
    }
    if (active?.text === text) {
      active = { ...active, end: now + 1_000 }
      postLiveCue([active])
      return
    }
    const closed = active ? [{ ...active, end: Math.max(active.start + 250, now) }] : []
    active = { text, start: now, end: now + 1_000 }
    postLiveCue([...closed, active])
  }
  const observer = new MutationObserver(emit)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  const intervalId = window.setInterval(emit, 500)
  emit()
  return () => {
    observer.disconnect()
    window.clearInterval(intervalId)
    if (previous && !previous.isNoneTrack)
      player.setTimedTextTrack(previous)
  }
}

function postLiveCue(fragments: Array<{ text: string, start: number, end: number }>) {
  window.postMessage({ type: STREAMING_LIVE_CAPTURE_CUE_TYPE, fragments }, window.location.origin)
}

export function injectStreamingSubtitlesInterceptor() {
  if (window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ || !NETFLIX_HOST.test(window.location.hostname))
    return
  window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ = true

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin)
      return
    if (event.data?.type === STREAMING_LIVE_CAPTURE_START_TYPE) {
      stopNetflixLiveCapture?.()
      stopNetflixLiveCapture = startNetflixLiveCapture()
      return
    }
    if (event.data?.type === STREAMING_LIVE_CAPTURE_STOP_TYPE) {
      stopNetflixLiveCapture?.()
      stopNetflixLiveCapture = null
      return
    }
    if (event.data?.type !== STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE)
      return
    const tracks = [...tracksByKey.values()].filter(track => track.pagePath === pagePath())
    postTracks([...tracks, ...netflixPlayerTracks()])
    if (!tracks.length)
      replayKnownResources()
  })

  const originalParse = JSON.parse
  JSON.parse = function (text, reviver) {
    const result = originalParse.call(this, text, reviver)
    if (typeof text === "string")
      publishFromJson(text)
    return result
  }

  const originalFetch = window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch.call(this, input, init)
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    void response.clone().text().then(text => inspectJson(url, text, response.headers.get("content-type"))).catch(() => {})
    return response
  }

  const originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
    ;(this as any).__readFrogUrl = url.toString()
    return originalOpen.apply(this, [method, url, ...args] as any)
  }
  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener("load", function () {
      const url = this.responseURL || (this as any).__readFrogUrl
      const text = this.responseType === "" || this.responseType === "text" ? this.responseText : null
      inspectJson(url, text, this.getResponseHeader("content-type"))
    })
    return originalSend.apply(this, args as any)
  }
}
