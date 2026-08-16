export const MINIMAX_TTS_ENDPOINTS = {
  global: "https://api.minimax.io/v1/t2a_v2",
  china: "https://api.minimaxi.com/v1/t2a_v2",
} as const

export const MINIMAX_TTS_REGIONS = ["global", "china"] as const
export type MiniMaxTTSRegion = (typeof MINIMAX_TTS_REGIONS)[number]

export const MINIMAX_SPEECH_MODELS = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
  "speech-01-hd",
  "speech-01-turbo",
] as const
export type MiniMaxSpeechModel = (typeof MINIMAX_SPEECH_MODELS)[number]

export const MINIMAX_TTS_AUDIO_FORMATS = ["mp3", "wav", "flac", "pcm"] as const
export type MiniMaxTTSAudioFormat = (typeof MINIMAX_TTS_AUDIO_FORMATS)[number]

export interface MiniMaxTTSConfig {
  region: MiniMaxTTSRegion
  model: MiniMaxSpeechModel
  voiceId: string
  audioFormat: MiniMaxTTSAudioFormat
}

export interface MiniMaxTTSSynthesizeRequest extends MiniMaxTTSConfig {
  apiKey: string
  text: string
}

export const MINIMAX_TTS_ERROR_CODES = [
  "INVALID_CONFIG",
  "INVALID_TEXT",
  "REQUEST_FAILED",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "NETWORK_ERROR",
  "INVALID_RESPONSE",
] as const
export type MiniMaxTTSErrorCode = (typeof MINIMAX_TTS_ERROR_CODES)[number]

export interface MiniMaxTTSErrorPayload {
  code: MiniMaxTTSErrorCode
  message: string
  retryable?: boolean
  status?: number
}

export interface MiniMaxTTSSynthesizeSuccess {
  ok: true
  audio: ArrayBuffer
  contentType: string
}

export interface MiniMaxTTSSynthesizeFailure {
  ok: false
  error: MiniMaxTTSErrorPayload
}

export type MiniMaxTTSSynthesizeResponse = MiniMaxTTSSynthesizeSuccess | MiniMaxTTSSynthesizeFailure

export interface MiniMaxTTSSynthesizeWireSuccess {
  ok: true
  audioBase64: string
  contentType: string
}

export type MiniMaxTTSSynthesizeWireResponse =
  | MiniMaxTTSSynthesizeWireSuccess
  | MiniMaxTTSSynthesizeFailure
