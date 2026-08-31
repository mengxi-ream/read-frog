/**
 * In-tab memory tier in front of the background IndexedDB translation cache,
 * keyed by the same request hash (so the two tiers can never disagree about
 * identity: provider, languages, prompts and text format are all inside the
 * key).
 *
 * Why it exists: virtualized pages (X timelines and articles, and any React
 * list that unmounts off-screen rows) destroy paragraph nodes on scroll and
 * recreate brand-new ones on the way back. Every per-node marker — walked
 * attributes, wrapper classes, WeakMap state, retranslation budgets — dies
 * with the old node, so the added-subtree path re-runs the whole pipeline for
 * text this tab already translated. The IndexedDB tier saves the provider
 * call, but each paragraph still pays a message round trip, so translations
 * re-land staggered behind spinners. Serving those re-runs synchronously from
 * here lets a remounted region recover its translations without visible
 * churn.
 *
 * Lifetime is the page itself (module scope, one copy per frame). Entries are
 * exactly the strings this tab already rendered, so there is no staleness a
 * user could observe; config changes rotate the hash and miss naturally.
 */

/**
 * Insertion-ordered for LRU eviction. The cap comfortably covers the largest
 * single-page unit count observed in the wild (~400 paragraphs for a long X
 * article) while bounding a long timeline-scrolling session; values are
 * translation strings only, so even the full cap stays around a megabyte.
 */
export const IN_MEMORY_TRANSLATION_CACHE_MAX_ENTRIES = 1000

const cache = new Map<string, string>()

export function getInMemoryTranslation(hash: string): string | undefined {
  const hit = cache.get(hash)
  if (hit !== undefined) {
    // Refresh recency so scroll loops over the same region keep their entries.
    cache.delete(hash)
    cache.set(hash, hit)
  }
  return hit
}

export function storeInMemoryTranslation(hash: string, translation: string): void {
  // Mirror the background's truthy-only cache write: an empty result must
  // retry the pipeline next time, not become a permanent blank paragraph.
  if (!translation) {
    return
  }
  cache.delete(hash)
  cache.set(hash, translation)
  if (cache.size > IN_MEMORY_TRANSLATION_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
}

export function clearInMemoryTranslationCache(): void {
  cache.clear()
}
