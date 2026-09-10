/** A glossary entry as the matcher consumes it — the storage row minus what matching ignores. */
export interface GlossaryEntry {
  matchKey: string
  source: string
  /** Empty string means "keep the original". */
  target: string
  caseSensitive: boolean
}

export interface MatchedTerm {
  matchKey: string
  source: string
  target: string
  /** True when `target` is empty, i.e. the term must be reproduced unchanged. */
  keepOriginal: boolean
}

/**
 * The seam that lets the implementation change without touching any caller.
 *
 * Today this is a single compiled RegExp alternation plus a lookup index, which
 * measured at 0.25-0.72 ms per page at the 20,000-term cap. Aho-Corasick becomes
 * competitive somewhere past that (its scan is flat in term count while the
 * alternation's rises), and a validated CSR implementation is kept in
 * docs/glossary-research/. Swapping it means implementing this interface and
 * nothing else. See docs/glossary-feature-plan.md sections 3 and D5-D8.
 */
export interface GlossaryMatcher {
  /** Terms present in `text`, deduped, in a deterministic order. */
  match: (text: string) => MatchedTerm[]
  /** How many entries the matcher was built from. */
  readonly size: number
}
