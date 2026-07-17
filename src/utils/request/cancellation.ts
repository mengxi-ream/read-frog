export const TRANSLATION_CANCELLED_ERROR_NAME = "TranslationCancelledError"

/**
 * Rejection used when the user cancels a page-translation session and its
 * queued/in-flight requests are drained (#1881). Detection is name-based so it
 * survives the content↔background messaging boundary: background rejections
 * are re-created on the sender side by zero-serialize-error, which preserves
 * `name` but not the prototype chain.
 */
export class TranslationCancelledError extends Error {
  constructor(scope?: string) {
    super(`Translation request cancelled${scope ? ` (scope: ${scope})` : ""}`)
    this.name = TRANSLATION_CANCELLED_ERROR_NAME
  }
}

export function isTranslationCancelledError(error: unknown): boolean {
  return error instanceof Error && error.name === TRANSLATION_CANCELLED_ERROR_NAME
}
