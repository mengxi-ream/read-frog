import type { JSONValue } from 'ai'

export interface BackgroundGenerateTextPayload {
  providerId: string
  system?: string
  prompt: string
  temperature?: number
  providerOptions?: Record<string, Record<string, JSONValue>>
  maxRetries?: number
}

export interface BackgroundGenerateTextResponse {
  text: string
}
