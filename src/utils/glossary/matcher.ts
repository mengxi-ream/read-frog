import type { BoundaryRequirement } from "./boundary"
import type { GlossaryEntry, GlossaryMatcher, MatchedTerm } from "./types"
import { INVISIBLE_TRANSLATION_CHARACTERS_REGEX } from "../host/translate/text-preparation"
import { logger } from "../logger"
import { boundaryRequirementOf, isAtWordBoundary } from "./boundary"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Compile one term into a pattern that tolerates however the page happens to
 * separate its words.
 *
 * A user types `Chort Bay` with one space; the page may hold two spaces, a
 * newline from wrapped source, a tab, a non-breaking space (routine in HTML), or
 * a full-width space between CJK words. Matching the literal string finds none
 * of them. `\s+` covers all of these: JavaScript's `\s` already includes U+00A0
 * and U+3000.
 */
function termToPattern(source: string): string {
  return source.trim().split(/\s+/).map(escapeRegExp).join("\\s+")
}

/**
 * Unicode normalisation form used on both sides before matching.
 *
 * `café` can be one code point (U+00E9) or two (e + U+0301), and both spellings
 * occur on the web — they look identical and compare unequal. Normalising the
 * term list at build and each segment at match time makes them the same string.
 * NFC because it is the form the web overwhelmingly uses, so the usual case is a
 * fast no-op inside V8.
 */
function normalize(value: string): string {
  return value.normalize("NFC")
}

/**
 * Strip the zero-width characters the translation pipeline already strips from
 * page text.
 *
 * A term is often pasted from a web page, and pages are full of these — a term
 * carrying one would compile into a pattern that can never match the stripped
 * text it is scanned against.
 */
function stripInvisible(value: string): string {
  return value.replace(INVISIBLE_TRANSLATION_CHARACTERS_REGEX, "")
}

interface IndexedEntry extends GlossaryEntry {
  boundary: BoundaryRequirement
}

const EMPTY_MATCHER: GlossaryMatcher = { match: () => [], size: 0 }

/**
 * Build a matcher over `entries`.
 *
 * One compiled non-capturing alternation plus a lookup index, rather than one
 * `indexOf` per term: `N x indexOf` is O(N x text) and measured 351 ms per page
 * at 5,000 terms, against 0.72 ms for the alternation at 20,000. Per-term
 * capture groups were also rejected — attributing a hit by scanning capture
 * slots is O(matches x terms) and measured 12-13x slower than this index.
 */
export function createGlossaryMatcher(entries: readonly GlossaryEntry[]): GlossaryMatcher {
  // An empty source would compile to an alternation branch that matches at every
  // position without consuming input.
  const usable = entries
    .filter((entry) => stripInvisible(entry.source).trim() !== "")
    // Trimmed to agree with `buildMatchKey`, which trims too — an entry stored
    // with stray outer spaces otherwise compiled a pattern that could not match.
    .map((entry) => ({ ...entry, source: normalize(stripInvisible(entry.source).trim()) }))
  if (usable.length === 0) return EMPTY_MATCHER

  // Bucketed by case-folded source so a single case-insensitive scan can serve
  // both case modes. Within a bucket the case-sensitive entry sorts first: it is
  // the more specific claim on the same text.
  const index = new Map<string, IndexedEntry[]>()
  for (const entry of usable) {
    const folded = entry.source.toLowerCase()
    const indexed: IndexedEntry = { ...entry, boundary: boundaryRequirementOf(entry.source) }
    const bucket = index.get(folded)
    if (bucket) bucket.push(indexed)
    else index.set(folded, [indexed])
  }
  for (const bucket of index.values()) {
    bucket.sort((a, b) => Number(b.caseSensitive) - Number(a.caseSensitive))
  }

  // Longest-first so the alternation yields leftmost-longest: `Chort Bay` must
  // win over a `Chort` entry at the same position.
  const sources = [...new Set(usable.map((entry) => entry.source))].sort(
    (a, b) => b.length - a.length,
  )
  const pattern = new RegExp(`(?:${sources.map(termToPattern).join("|")})`, "gi")

  return {
    size: usable.length,
    match(rawText: string): MatchedTerm[] {
      if (rawText === "") return []
      const text = normalize(rawText)

      const hits = new Map<string, MatchedTerm>()
      pattern.lastIndex = 0

      let match: RegExpExecArray | null = pattern.exec(text)
      while (match !== null) {
        const matched = match[0]
        const start = match.index

        let accepted: IndexedEntry | undefined
        // The hit may carry the page's whitespace (two spaces, a newline, a
        // non-breaking space) while the index is keyed on the single-spaced
        // term, so fold runs of whitespace back down before looking it up.
        const bucket = index.get(matched.replace(/\s+/g, " ").toLowerCase())
        if (bucket) {
          for (const entry of bucket) {
            if (entry.caseSensitive && entry.source !== matched.replace(/\s+/g, " ")) continue
            if (!isAtWordBoundary(text, start, start + matched.length, entry.boundary)) continue
            accepted = entry
            break
          }
        } else {
          // The regex `i` flag's canonicalisation and String#toLowerCase are not
          // the same relation — Greek final sigma is the reachable case — so a
          // hit can miss the index. Rare enough to log rather than defend.
          logger.log("Glossary match had no index entry", { matched })
        }

        if (accepted) {
          if (!hits.has(accepted.matchKey)) {
            hits.set(accepted.matchKey, {
              matchKey: accepted.matchKey,
              source: accepted.source,
              target: accepted.target,
              keepOriginal: accepted.target === "",
            })
          }
          pattern.lastIndex = start + matched.length
        } else {
          // Resume ONE character in, not past the match. Skipping the whole span
          // would hide a shorter term that starts inside it.
          pattern.lastIndex = start + 1
        }

        match = pattern.exec(text)
      }

      // Ordered by identity, not by where the text mentioned them, so the same
      // SET of terms always renders the same block. That block lands in the
      // system prompt, which is itself part of the translation cache key
      // (host/translate/translate-text.ts:146) — a per-paragraph ordering would
      // fragment the cache for no reason.
      return [...hits.values()].sort((a, b) => a.matchKey.localeCompare(b.matchKey))
    },
  }
}
