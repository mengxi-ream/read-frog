/**
 * Identity of the current page-translation session in this frame. Module
 * scope is correct: exactly one PageTranslationManager exists per frame.
 *
 * Every page-translation request carries this id so the background can drain
 * the session's queued/in-flight requests when the user cancels (#1881). A
 * fresh id per session means cancelling an old wave can never affect a
 * restarted session's requests.
 *
 * The id is a correlation key, not cryptographic material — it deliberately
 * avoids getRandomUUID so sessions never consume from the same source as walk
 * ids. The random component keeps ids unique across frames of the same tab
 * (the background scopes by tab id + session id only).
 */
import type { HostedAiReasoning } from "@/utils/hosted-ai/types"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"

let currentPageTranslationSessionId: string | null = null
let sessionCounter = 0

/**
 * Provider ref resolved once by start()'s availability gate and reused for
 * every request of the session: per-paragraph serialization must not re-read
 * hosted status mid-page (a status blip would fail in-flight paragraphs, and
 * the model revision used for cache identity must stay stable per session).
 */
let currentSessionProviderRef: SerializableProviderRef | null = null
/**
 * The reasoning choice stored for the model when that ref was made. The
 * reasoning level is a user setting, not status, so it must not stay frozen:
 * a paragraph whose stored choice differs makes a new ref. The ref can't be
 * compared directly, because its level already falls back to the model's
 * default when the choice is unset or not one the model offers.
 */
let currentSessionReasoningChoice: HostedAiReasoning | undefined

export function beginPageTranslationSession(): string {
  sessionCounter += 1
  currentSessionProviderRef = null
  currentSessionReasoningChoice = undefined
  currentPageTranslationSessionId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${sessionCounter}`
  return currentPageTranslationSessionId
}

export function endPageTranslationSession(): string | null {
  const endedSessionId = currentPageTranslationSessionId
  currentPageTranslationSessionId = null
  currentSessionProviderRef = null
  currentSessionReasoningChoice = undefined
  return endedSessionId
}

export function getPageTranslationSessionId(): string | null {
  return currentPageTranslationSessionId
}

/**
 * `reasoningChoice` must be read before the ref was made, never after. Then a
 * change made while the ref was being made is newer than the recorded choice,
 * and the next paragraph makes a ref again instead of keeping the old level.
 */
export function setPageTranslationSessionProviderRef(
  providerRef: SerializableProviderRef,
  reasoningChoice: HostedAiReasoning | undefined,
): void {
  currentSessionProviderRef = providerRef
  currentSessionReasoningChoice = reasoningChoice
}

export function getPageTranslationSessionProviderRef(): {
  providerRef: SerializableProviderRef
  reasoningChoice: HostedAiReasoning | undefined
} | null {
  return currentSessionProviderRef
    ? { providerRef: currentSessionProviderRef, reasoningChoice: currentSessionReasoningChoice }
    : null
}
