import type { HostedAiTextStreamRoute } from "./background-stream"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"

export interface BackgroundGenerateTextPayload {
  providerRef: PromptableProviderRef
  /**
   * Which hosted route a system provider bills against. Ignored for local
   * providers, which have no server-side quota.
   */
  hostedFeature: HostedAiTextStreamRoute
  instructions: string
  prompt: string
  /**
   * Hosted billing idempotency key. Mint a fresh one per real model call — a
   * retry after an unusable answer is a new call, and reusing the key would
   * replay the original response.
   */
  requestId?: string
  /** Local providers only; hosted retries are the caller's business. */
  maxRetries?: number
}

export interface BackgroundGenerateTextResponse {
  text: string
}
