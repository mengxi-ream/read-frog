import { z } from 'zod'
import { SUBTITLE_INTERCEPT_MESSAGE_TYPE } from '@/utils/constants/subtitles'

// YouTube API response schemas
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

// XHR intercept message schema (from window.postMessage)
export const knownHttpErrorStatusSchema = z.union([
  z.literal(429),
  z.literal(404),
  z.literal(403),
  z.literal(500),
])

const xhrInterceptErrorStatusSchema = z.number()

export const subtitlesInterceptMessageSchema = z.object({
  type: z.literal(SUBTITLE_INTERCEPT_MESSAGE_TYPE),
  payload: z.string(),
  lang: z.string(),
  kind: z.string(),
  url: z.string(),
  errorStatus: xhrInterceptErrorStatusSchema.nullable(),
})

// Export types from schemas
export type YoutubeTimedTextSeg = z.infer<typeof youtubeTimedTextSegSchema>
export type YoutubeTimedText = z.infer<typeof youtubeTimedTextSchema>
export type YoutubeSubtitlesResponse = z.infer<typeof youtubeSubtitlesResponseSchema>
export type SubtitlesInterceptMessage = z.infer<typeof subtitlesInterceptMessageSchema>
export type XhrInterceptFetcherErrorStatus = z.infer<typeof xhrInterceptErrorStatusSchema>
