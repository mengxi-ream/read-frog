import type { ProviderRequestRouting } from "./hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"

export type BackgroundGenerateTextPayload = ProviderRequestRouting<PromptableProviderRef> & {
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
