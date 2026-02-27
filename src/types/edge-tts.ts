import type { EdgeTTSRequestParams, EdgeTTSVoice } from "@/utils/server/edge-tts/types"

export const EDGE_TTS_ERROR_CODES = [
  "UNSUPPORTED_BROWSER",
  "FEATURE_DISABLED",
  "CIRCUIT_OPEN",
  "INVALID_TEXT",
  "TEXT_TOO_LONG",
  "SIGNATURE_GENERATION_FAILED",
  "TOKEN_FETCH_FAILED",
  "TOKEN_INVALID",
  "SYNTH_RATE_LIMITED",
  "SYNTH_SERVER_ERROR",
  "SYNTH_REQUEST_FAILED",
  "VOICES_FETCH_FAILED",
  "NETWORK_ERROR",
  "UNKNOWN_ERROR",
] as const

export type EdgeTTSErrorCode = typeof EDGE_TTS_ERROR_CODES[number]

export interface EdgeTTSErrorPayload {
  code: EdgeTTSErrorCode
  message: string
  retryable?: boolean
  status?: number
}

export interface EdgeTTSSynthesizeRequest extends EdgeTTSRequestParams {
  outputFormat?: string
}

export interface EdgeTTSSynthesizeSuccess {
  ok: true
  audio: ArrayBuffer
  contentType: string
}

export interface EdgeTTSSynthesizeFailure {
  ok: false
  error: EdgeTTSErrorPayload
}

export type EdgeTTSSynthesizeResponse = EdgeTTSSynthesizeSuccess | EdgeTTSSynthesizeFailure

export interface EdgeTTSSynthesizeWireSuccess {
  ok: true
  audioBase64: string
  contentType: string
}

export type EdgeTTSSynthesizeWireResponse = EdgeTTSSynthesizeWireSuccess | EdgeTTSSynthesizeFailure

export interface EdgeTTSHealthStatus {
  provider: "edge-tts"
  available: boolean
  browserSupported: boolean
  featureEnabled: boolean
  circuitOpen: boolean
  circuitOpenUntil: number | null
  checkedAt: number
  reason?: string
  error?: EdgeTTSErrorPayload
}

export interface EdgeTTSListVoicesResponse {
  ok: true
  voices: EdgeTTSVoice[]
}
