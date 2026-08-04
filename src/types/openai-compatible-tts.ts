import type { TTSConfig } from "@/types/config/tts"

export type OpenAICompatibleTTSRequestConfig = TTSConfig["openAICompatible"]

export interface OpenAICompatibleTTSSynthesizeRequest {
  text: string
  config: OpenAICompatibleTTSRequestConfig
}

export interface OpenAICompatibleTTSSynthesizeSuccess {
  ok: true
  audioBase64: string
  contentType: string
}

export interface OpenAICompatibleTTSSynthesizeFailure {
  ok: false
  error: {
    code: "INVALID_CONFIG" | "REQUEST_FAILED" | "EMPTY_AUDIO" | "NETWORK_ERROR"
    message: string
    status?: number
  }
}

export type OpenAICompatibleTTSSynthesizeResponse =
  | OpenAICompatibleTTSSynthesizeSuccess
  | OpenAICompatibleTTSSynthesizeFailure
