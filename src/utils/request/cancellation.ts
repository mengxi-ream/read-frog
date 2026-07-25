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

/**
 * Remembers cancelled scopes so an enqueue handler that was suspended on an
 * await (e.g. the IndexedDB cache lookup) when the cancel drained the queues
 * can refuse to enqueue afterwards — otherwise the request enters the queue
 * with a dead scope that no future cancel will ever drain (#1881).
 *
 * Session ids are never reused, so remembering a scope can never wrongly
 * reject a live request; the TTL and size cap exist purely to bound memory.
 */
export class CancelledScopeRegistry {
  private readonly scopes = new Map<string, number>()
  private readonly prefixes = new Map<string, number>()

  constructor(
    private readonly ttlMs: number = 10 * 60_000,
    private readonly maxEntries: number = 256,
  ) {}

  markScope(scopeKey: string): void {
    this.scopes.set(scopeKey, Date.now())
    this.prune()
  }

  /** Mark every scope of a tab (tab close sweep), e.g. `${tabId}:`. */
  markPrefix(scopePrefix: string): void {
    this.prefixes.set(scopePrefix, Date.now())
    this.prune()
  }

  has(scopeKey: string): boolean {
    if (this.scopes.has(scopeKey)) return true
    for (const prefix of this.prefixes.keys()) {
      if (scopeKey.startsWith(prefix)) return true
    }
    return false
  }

  private prune(): void {
    const cutoff = Date.now() - this.ttlMs
    for (const map of [this.scopes, this.prefixes]) {
      for (const [key, markedAt] of map) {
        if (markedAt < cutoff) map.delete(key)
      }
      // Maps iterate in insertion order, so overflow evicts the oldest first.
      while (map.size > this.maxEntries) {
        map.delete(map.keys().next().value!)
      }
    }
  }
}
