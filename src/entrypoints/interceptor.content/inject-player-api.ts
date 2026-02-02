import { PLAYER_DATA_REQUEST_TYPE, PLAYER_DATA_RESPONSE_TYPE } from '@/utils/constants/subtitles'

interface PlayerDataRequest {
  type: typeof PLAYER_DATA_REQUEST_TYPE
  requestId: string
  expectedVideoId: string
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
  vssId: string
  name?: { simpleText: string }
  trackName?: string
}

interface AudioCaptionTrack {
  url: string
  vssId: string
  kind?: string
  languageCode?: string
}

interface PlayerDataResponse {
  type: typeof PLAYER_DATA_RESPONSE_TYPE
  requestId: string
  success: boolean
  error?: string
  data?: {
    videoId: string
    captionTracks: CaptionTrack[]
    audioCaptionTracks: AudioCaptionTrack[]
    device: string | null
    cver: string | null
    playerState: number
  }
}

interface YouTubePlayer extends HTMLElement {
  getPlayerResponse?: () => any
  getAudioTrack?: () => any
  getPlayerState?: () => number
  getWebPlayerContextConfig?: () => any
}

declare global {
  interface Window {
    ytcfg?: {
      get?: (key: string) => string | undefined
    }
  }
}

export function injectPlayerApi(): void {
  window.addEventListener('message', handleMessage)
}

function handleMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin)
    return
  if (event.data?.type !== PLAYER_DATA_REQUEST_TYPE)
    return

  const request = event.data as PlayerDataRequest
  const response = getPlayerData(request)
  window.postMessage(response, window.location.origin)
}

function getPlayerData(request: PlayerDataRequest): PlayerDataResponse {
  const { requestId, expectedVideoId } = request

  try {
    const player = document.querySelector(
      '.html5-video-player.playing-mode, .html5-video-player.paused-mode',
    ) as YouTubePlayer | null

    if (!player) {
      return {
        type: PLAYER_DATA_RESPONSE_TYPE,
        requestId,
        success: false,
        error: 'PLAYER_NOT_FOUND',
      }
    }

    const playerResponse = player.getPlayerResponse?.()
    const videoId = playerResponse?.videoDetails?.videoId

    if (!videoId || videoId !== expectedVideoId) {
      return {
        type: PLAYER_DATA_RESPONSE_TYPE,
        requestId,
        success: false,
        error: 'VIDEO_ID_MISMATCH',
      }
    }

    const captionTracks: CaptionTrack[]
      = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

    captionTracks.forEach((track) => {
      if (track.baseUrl && !track.baseUrl.includes('://')) {
        track.baseUrl = `${window.location.origin}${track.baseUrl}`
      }
    })

    const audioCaptionTracks: AudioCaptionTrack[] = []
    try {
      const audioTrack = player.getAudioTrack?.()
      if (audioTrack?.captionTracks) {
        for (const t of audioTrack.captionTracks) {
          try {
            audioCaptionTracks.push({
              url: t.url,
              vssId: t.vssId,
              kind: t.kind,
              languageCode: new URL(t.url).searchParams.get('lang') ?? undefined,
            })
          }
          catch {}
        }
      }
    }
    catch {}

    const device = window.ytcfg?.get?.('DEVICE') ?? null

    let cver: string | null = null
    try {
      cver = player.getWebPlayerContextConfig?.()?.innertubeContextClientVersion ?? null
    }
    catch {}

    const playerState = player.getPlayerState?.() ?? -1

    return {
      type: PLAYER_DATA_RESPONSE_TYPE,
      requestId,
      success: true,
      data: {
        videoId,
        captionTracks,
        audioCaptionTracks,
        device,
        cver,
        playerState,
      },
    }
  }
  catch (e) {
    return {
      type: PLAYER_DATA_RESPONSE_TYPE,
      requestId,
      success: false,
      error: String(e),
    }
  }
}
