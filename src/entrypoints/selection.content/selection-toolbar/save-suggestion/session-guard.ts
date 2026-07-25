/**
 * In-memory (per content-script lifetime) suppression: after an empty,
 * invalid, or errored suggestion result, stop firing further requests on this
 * page to protect the shared hosted-AI quota. Aborted requests (popover
 * closed) do NOT suppress.
 */
let suppressedForPageSession = false

export function isSaveSuggestionSuppressedForPageSession(): boolean {
  return suppressedForPageSession
}

export function suppressSaveSuggestionForPageSession(): void {
  suppressedForPageSession = true
}

export function resetSaveSuggestionPageSessionForTesting(): void {
  suppressedForPageSession = false
}
