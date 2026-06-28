import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_LIVE_CAPTURE_CUE_TYPE,
  STREAMING_LIVE_CAPTURE_START_TYPE,
  STREAMING_LIVE_CAPTURE_STOP_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
} from "@/utils/constants/subtitles"
import { startDomLiveCapture } from "@/utils/subtitles/fetchers/streaming/live-capture"

interface InterceptedTrack {
  id?: string
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
const NETFLIX_PLAYER_TRACK_KIND = "netflix-player"
const NETFLIX_CAPTION_SELECTOR = ".player-timedtext-text-container, [data-uia='player-timedtext'], .player-timedtext"
let stopNetflixLiveCapture: (() => void) | null = null

function pagePath(): string {
  return window.location.pathname
}

function trackKey(track: InterceptedTrack): string {
  return track.id ?? track.label ?? track.language ?? ""
}

function postTracks(tracks: InterceptedTrack[]) {
  const unique = [...new Map(tracks.map(track => [trackKey(track), track])).values()]
  if (unique.length)
    window.postMessage({ type: STREAMING_SUBTITLE_TRACKS_TYPE, tracks: unique }, window.location.origin)
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

function postLiveCue(fragments: Array<{ text: string, start: number, end: number }>) {
  window.postMessage({ type: STREAMING_LIVE_CAPTURE_CUE_TYPE, fragments }, window.location.origin)
}

function startNetflixLiveCapture() {
  const player = getNetflixPlayer()
  const track = getNetflixSourceTrack()
  if (!player || !track)
    return null

  const previous = player.getTimedTextTrack?.()
  player.setTimedTextTrack(track)
  const stop = startDomLiveCapture({
    readText: readNativeCaptionText,
    currentTimeMs: currentVideoTimeMs,
    onFragments: postLiveCue,
  })

  return () => {
    stop()
    if (previous)
      player.setTimedTextTrack(previous)
  }
}

export function injectStreamingSubtitlesInterceptor() {
  if (window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ || !NETFLIX_HOST.test(window.location.hostname))
    return
  window.__READ_FROG_STREAMING_SUBTITLES_INTERCEPTOR__ = true

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin)
      return
    if (event.data?.type === STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE) {
      postTracks(netflixPlayerTracks())
      return
    }
    if (event.data?.type === STREAMING_LIVE_CAPTURE_START_TYPE) {
      stopNetflixLiveCapture?.()
      stopNetflixLiveCapture = startNetflixLiveCapture()
      return
    }
    if (event.data?.type === STREAMING_LIVE_CAPTURE_STOP_TYPE) {
      stopNetflixLiveCapture?.()
      stopNetflixLiveCapture = null
    }
  })
}
