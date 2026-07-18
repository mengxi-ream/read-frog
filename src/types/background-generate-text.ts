import type { JSONValue } from "ai"
import type { AISDKReasoning } from "./config/provider"

export interface BackgroundGenerateTextPayload {
  providerId: string
  instructions?: string
  prompt: string
  temperature?: number
  reasoning?: AISDKReasoning
  providerOptions?: Record<string, Record<string, JSONValue>>
  maxRetries?: number
}

export interface BackgroundGenerateTextResponse {
  text: string
}
