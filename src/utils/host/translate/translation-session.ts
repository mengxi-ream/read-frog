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

export function beginPageTranslationSession(): string {
  sessionCounter += 1
  currentSessionProviderRef = null
  currentPageTranslationSessionId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${sessionCounter}`
  return currentPageTranslationSessionId
}

export function endPageTranslationSession(): string | null {
  const endedSessionId = currentPageTranslationSessionId
  currentPageTranslationSessionId = null
  currentSessionProviderRef = null
  return endedSessionId
}

export function getPageTranslationSessionId(): string | null {
  return currentPageTranslationSessionId
}

export function setPageTranslationSessionProviderRef(providerRef: SerializableProviderRef): void {
  currentSessionProviderRef = providerRef
}

export function getPageTranslationSessionProviderRef(): SerializableProviderRef | null {
  return currentSessionProviderRef
}
