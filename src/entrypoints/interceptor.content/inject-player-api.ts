import type { PlayerDataResponse } from "./utils"
import {
  ENSURE_SUBTITLES_REQUEST_TYPE,
  ENSURE_SUBTITLES_RESPONSE_TYPE,
  PLAYER_DATA_REQUEST_TYPE,
  PLAYER_DATA_RESPONSE_TYPE,
  TIMEDTEXT_WAIT_TIMEOUT_MS,
  WAIT_TIMEDTEXT_REQUEST_TYPE,
  WAIT_TIMEDTEXT_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { getCachedTimedtextUrl, setupTimedtextObserver, waitForTimedtextUrl } from "./timedtext-observer"
import { errorResponse, normalizeTracks, parseAudioTracks } from "./utils"

interface PlayerDataRequest {
  type: typeof PLAYER_DATA_REQUEST_TYPE
  requestId: string
  expectedVideoId: string
}

interface YouTubePlayer extends HTMLElement {
  getPlayerResponse?: () => any
  getAudioTrack?: () => any
  getPlayerState?: () => number
  getWebPlayerContextConfig?: () => any
  getOption?: (module: string, option: string) => any
  toggleSubtitles?: () => void
}

declare global {
  interface Window {
    ytcfg?: {
      get?: (key: string) => string | undefined
    }
  }
}

function findYoutubePlayer(): YouTubePlayer | null {
  return document.querySelector(
    ".html5-video-player.playing-mode, .html5-video-player.paused-mode",
  )
}

export function injectPlayerApi(): void {
  setupTimedtextObserver()
  window.addEventListener("message", handleMessage)
}

function handleMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin)
    return

  if (event.data?.type === PLAYER_DATA_REQUEST_TYPE) {
    const request = event.data as PlayerDataRequest
    const response = getPlayerData(request)
    window.postMessage(response, window.location.origin)
  }

  if (event.data?.type === WAIT_TIMEDTEXT_REQUEST_TYPE) {
    const { requestId, videoId } = event.data
    void waitForTimedtextUrl(videoId, TIMEDTEXT_WAIT_TIMEOUT_MS).then((url) => {
      window.postMessage({
        type: WAIT_TIMEDTEXT_RESPONSE_TYPE,
        requestId,
        url,
      }, window.location.origin)
    })
  }

  if (event.data?.type === ENSURE_SUBTITLES_REQUEST_TYPE) {
    const { requestId } = event.data
    ensureSubtitlesEnabled()
    window.postMessage({
      type: ENSURE_SUBTITLES_RESPONSE_TYPE,
      requestId,
    }, window.location.origin)
  }
}

function getPlayerData(request: PlayerDataRequest): PlayerDataResponse {
  const { requestId, expectedVideoId } = request

  try {
    const player = findYoutubePlayer()

    if (!player)
      return errorResponse(requestId, "PLAYER_NOT_FOUND")

    const playerResponse = player.getPlayerResponse?.()
    const videoId = playerResponse?.videoDetails?.videoId

    if (!videoId || videoId !== expectedVideoId)
      return errorResponse(requestId, "VIDEO_ID_MISMATCH")

    return {
      type: PLAYER_DATA_RESPONSE_TYPE,
      requestId,
      success: true,
      data: {
        videoId,
        captionTracks: normalizeTracks(
          playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [],
        ),
        audioCaptionTracks: parseAudioTracks(player.getAudioTrack?.()?.captionTracks),
        device: window.ytcfg?.get?.("DEVICE") ?? null,
        cver: player.getWebPlayerContextConfig?.()?.innertubeContextClientVersion ?? null,
        playerState: player.getPlayerState?.() ?? -1,
        selectedTrackLanguageCode: player.getOption?.("captions", "track")?.languageCode ?? null,
        cachedTimedtextUrl: getCachedTimedtextUrl(videoId),
      },
    }
  }
  catch (e) {
    return errorResponse(requestId, String(e))
  }
}

function ensureSubtitlesEnabled(): void {
  const button = document.querySelector(".ytp-subtitles-button") as HTMLElement | null
  if (!button)
    return

  if (button.getAttribute("aria-pressed") === "true")
    return

  const player = findYoutubePlayer()

  if (player?.toggleSubtitles) {
    player.toggleSubtitles()
  }
  else {
    button.click()
  }
}
