import { z } from "zod"

export interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string // 'asr' = auto-generated
  vssId: string
  name?: { simpleText: string }
  trackName?: string
}

export interface AudioCaptionTrack {
  url: string // Contains pot/potc params
  vssId: string
  kind?: string
  languageCode?: string
}

export interface PlayerData {
  videoId: string
  captionTracks: CaptionTrack[]
  audioCaptionTracks: AudioCaptionTrack[]
  device: string | null
  cver: string | null
  playerState: number
  selectedTrackLanguageCode: string | null
  cachedTimedtextUrl: string | null
}

export const youtubeTimedTextSegSchema = z.object({
  utf8: z.string(),
  tOffsetMs: z.number().optional(),
})

export const youtubeTimedTextSchema = z.object({
  tStartMs: z.number(),
  dDurationMs: z.number().optional(),
  aAppend: z.number().optional(),
  segs: z.array(youtubeTimedTextSegSchema).optional(),
  wpWinPosId: z.number().optional(),
  wWinId: z.number().optional(),
})

export const youtubeSubtitlesResponseSchema = z.object({
  events: z.array(youtubeTimedTextSchema),
})

export const knownHttpErrorStatusSchema = z.union([
  z.literal(429),
  z.literal(404),
  z.literal(403),
  z.literal(500),
])

// Export types from schemas
export type YoutubeTimedTextSeg = z.infer<typeof youtubeTimedTextSegSchema>
export type YoutubeTimedText = z.infer<typeof youtubeTimedTextSchema>
export type YoutubeSubtitlesResponse = z.infer<typeof youtubeSubtitlesResponseSchema>
