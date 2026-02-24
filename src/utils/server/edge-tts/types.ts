/**
 * Edge TTS 类型定义
 */

import { z } from "zod"

export interface EdgeTTSVoice {
  Name: string
  ShortName?: string
  Gender: string
  ContentCategories: string
  VoicePersonalities: string
  Locale: string
  SuggestedCodec: string
  FriendlyName: string
  Status: string
}

export interface EdgeTTSRequestParams {
  text: string
  voice: string
  rate?: string
  pitch?: string
  volume?: string
  outputFormat?: string
}

export const edgeTTSConfigSchema = z.object({
  voice: z.string(),
  rate: z.string().optional().default("+0%"),
  pitch: z.string().optional().default("+0Hz"),
  volume: z.string().optional().default("+0%"),
})

export type EdgeTTSConfig = z.infer<typeof edgeTTSConfigSchema>

export interface EdgeTTSResponse {
  audio: ArrayBuffer
  contentType: string
}

export interface EdgeTTSEndpointResponse {
  r: string
  t: string
  [key: string]: unknown
}

export interface EdgeTTSTokenInfo {
  endpoint: EdgeTTSEndpointResponse
  token: string
  expiredAt: number
}

export interface EdgeTTSCachedVoices {
  voices: EdgeTTSVoice[]
  cachedAt: number
}
