import type { ProviderConfig } from "@/types/config/provider"

export const GEMINI_TTS_ERROR_CODES = [
  "INVALID_TEXT",
  "MISSING_API_KEY",
  "REQUEST_REJECTED",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "EMPTY_AUDIO",
  "NETWORK_ERROR",
] as const

export type GeminiTTSErrorCode = (typeof GEMINI_TTS_ERROR_CODES)[number]

/** A Google (Gemini) provider from API Providers, whose API key, base URL and headers Gemini TTS uses. */
export type GoogleProviderConfig = Extract<ProviderConfig, { provider: "google" }>

export interface GeminiTTSSynthesizeRequest {
  text: string
  /**
   * The whole provider config, as a provider ref carries it, so the request goes out with the
   * key, base URL and headers every other request through that provider uses.
   */
  providerConfig: GoogleProviderConfig
  model: string
  voice: string
  style: string
}

export interface GeminiTTSSynthesizeSuccess {
  ok: true
  audioBase64: string
  contentType: string
}

export interface GeminiTTSFailure {
  ok: false
  error: {
    code: GeminiTTSErrorCode
    message: string
    status?: number
  }
}

export type GeminiTTSSynthesizeResponse = GeminiTTSSynthesizeSuccess | GeminiTTSFailure

export type GeminiTTSVoiceGender = "female" | "male" | "neutral"
export type GeminiTTSVoicePitch = "low" | "medium" | "high"

/** One voice from Gemini's voice library; `voice` is the id the API takes as `voiceName`. */
export interface GeminiTTSVoice {
  voice: string
  name: string
  languageCode: string
  accent: string
  /** The broad persona ("Storyteller & Narrator"), which groups voices by what they suit. */
  useCase: string
  description: string
  gender: GeminiTTSVoiceGender
  pitch: GeminiTTSVoicePitch
}

export interface GeminiTTSListVoicesRequest {
  providerConfig: GoogleProviderConfig
}

export type GeminiTTSListVoicesResponse = { ok: true; voices: GeminiTTSVoice[] } | GeminiTTSFailure
