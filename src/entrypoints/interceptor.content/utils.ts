import type { AudioCaptionTrack, CaptionTrack, PlayerData } from "@/utils/subtitles/fetchers/youtube/types"
import { PLAYER_DATA_RESPONSE_TYPE } from "@/utils/constants/subtitles"

export interface PlayerDataResponse {
  type: typeof PLAYER_DATA_RESPONSE_TYPE
  requestId: string
  success: boolean
  error?: string
  data?: PlayerData
}

export function errorResponse(requestId: string, error: string): PlayerDataResponse {
  return {
    type: PLAYER_DATA_RESPONSE_TYPE,
    requestId,
    success: false,
    error,
  }
}

export function normalizeTracks(tracks: CaptionTrack[]): CaptionTrack[] {
  return tracks.map(t => ({
    ...t,
    baseUrl: t.baseUrl?.includes("://") ? t.baseUrl : `${location.origin}${t.baseUrl}`,
  }))
}

export function parseAudioTracks(tracks?: any[]): AudioCaptionTrack[] {
  return (tracks ?? []).flatMap((t) => {
    try {
      return [{
        url: t.url,
        vssId: t.vssId,
        kind: t.kind,
        languageCode: new URL(t.url).searchParams.get("lang") ?? undefined,
      }]
    }
    catch {
      return []
    }
  })
}
