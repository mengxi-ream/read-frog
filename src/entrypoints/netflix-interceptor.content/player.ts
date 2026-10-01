import type {
  NetflixSubtitlesAction,
  NetflixSubtitlesResponse,
} from "@/utils/subtitles/fetchers/netflix"
import {
  NETFLIX_SUBTITLES_REQUEST_TYPE,
  NETFLIX_SUBTITLES_RESPONSE_TYPE,
  NETFLIX_PAGE_POLL_INTERVAL_MS,
  NETFLIX_PAGE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { pollUntil } from "@/utils/poll"
import { findCapturedTtml } from "./ttml-capture"

interface TimedTextTrack {
  trackId: string
  bcp47: string | null
  isNoneTrack: boolean
  isForcedNarrative: boolean
  isImageBased?: boolean
}

interface NetflixPlayer {
  getMovieId: () => number
  getAudioTrack: () => { bcp47?: string } | null
  getTimedTextTrack: () => TimedTextTrack | null
  getTimedTextTrackList: () => TimedTextTrack[]
  setTimedTextTrack: (track: TimedTextTrack) => void
}

let replacedTrack: { movieId: number; track: TimedTextTrack; pickedTrackId: string } | null = null

const PAGE_WAIT = {
  timeoutMs: NETFLIX_PAGE_WAIT_TIMEOUT_MS,
  intervalMs: NETFLIX_PAGE_POLL_INTERVAL_MS,
}

function getReadyPlayer(): NetflixPlayer | null {
  try {
    const videoPlayer = (window as any).netflix.appContext.state.playerApp.getAPI().videoPlayer
    const sessionIds: string[] = videoPlayer.getAllPlayerSessionIds()
    const sessionId = sessionIds.find((id) => id.startsWith("watch")) ?? sessionIds[0]
    const player: NetflixPlayer | undefined = sessionId
      ? videoPlayer.getVideoPlayerBySessionId(sessionId)
      : undefined
    return player?.getTimedTextTrackList().length ? player : null
  } catch {
    return null
  }
}

function isTranslatable(track: TimedTextTrack | null): track is TimedTextTrack {
  return !!track && !track.isNoneTrack && !track.isForcedNarrative && !track.isImageBased
}

function primaryLanguage(language: string | null | undefined): string {
  return language?.split("-")[0]?.toLowerCase() ?? ""
}

function ensureTranslatableTrack(player: NetflixPlayer): TimedTextTrack | null {
  const current = player.getTimedTextTrack()
  if (isTranslatable(current)) return current

  const tracks = player.getTimedTextTrackList().filter(isTranslatable)
  const audioLanguage = primaryLanguage(player.getAudioTrack()?.bcp47)
  const next =
    tracks.find((track) => primaryLanguage(track.bcp47) === audioLanguage) ??
    tracks.find((track) => primaryLanguage(track.bcp47) === "en") ??
    tracks[0]
  if (!next) return null

  if (current) {
    replacedTrack = { movieId: player.getMovieId(), track: current, pickedTrackId: next.trackId }
  }
  player.setTimedTextTrack(next)
  return next
}

async function handleRequest(
  requestId: string,
  action: NetflixSubtitlesAction,
): Promise<NetflixSubtitlesResponse> {
  const response: NetflixSubtitlesResponse = {
    type: NETFLIX_SUBTITLES_RESPONSE_TYPE,
    requestId,
    movieId: null,
    trackId: null,
    translatable: false,
    ttml: null,
  }
  const player = await pollUntil(getReadyPlayer, PAGE_WAIT)
  if (!player) return response

  const movieId = player.getMovieId()
  if (action === "restore") {
    const previous = replacedTrack
    replacedTrack = null
    if (
      previous?.movieId === movieId &&
      player.getTimedTextTrack()?.trackId === previous.pickedTrackId
    ) {
      player.setTimedTextTrack(previous.track)
    }
  }

  const track = action === "load" ? ensureTranslatableTrack(player) : player.getTimedTextTrack()
  response.movieId = movieId
  response.trackId = track?.trackId ?? null
  response.translatable = isTranslatable(track)
  if (action === "load" && track && response.translatable) {
    response.ttml = await pollUntil(() => findCapturedTtml(movieId, track.trackId), PAGE_WAIT)
  }
  return response
}

export function listenForSubtitlesRequests(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== NETFLIX_SUBTITLES_REQUEST_TYPE
    ) {
      return
    }
    void handleRequest(event.data.requestId, event.data.action).then(
      (response) => window.postMessage(response, window.location.origin),
      () => {},
    )
  })
}
