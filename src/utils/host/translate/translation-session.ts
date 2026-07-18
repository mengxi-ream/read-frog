import type { TranslationActionContext } from "@/types/analytics"

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
let currentPageTranslationSessionId: string | null = null
let currentPageTranslationActionContext: TranslationActionContext | null = null
let sessionCounter = 0

export function beginPageTranslationSession(
  action?: Omit<TranslationActionContext, "actionId">,
): string {
  sessionCounter += 1
  currentPageTranslationSessionId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${sessionCounter}`
  currentPageTranslationActionContext = action
    ? { ...action, actionId: currentPageTranslationSessionId }
    : null
  return currentPageTranslationSessionId
}

export function endPageTranslationSession(): string | null {
  const endedSessionId = currentPageTranslationSessionId
  currentPageTranslationSessionId = null
  currentPageTranslationActionContext = null
  return endedSessionId
}

export function getPageTranslationSessionId(): string | null {
  return currentPageTranslationSessionId
}

export function getPageTranslationActionContext(): TranslationActionContext | null {
  return currentPageTranslationActionContext
}
