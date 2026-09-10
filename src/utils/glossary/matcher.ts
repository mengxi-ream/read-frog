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

/**
 * Fold every run of whitespace down to a single space, and trim the ends.
 *
 * `termToPattern` compiles a term's internal whitespace to `\s+`, so a source's
 * own spacing is already meaningless to MATCHING — but it survived into the
 * index key, the case-sensitive comparison and the `sources` dedupe, none of
 * which fold it. A term stored as `Chort  Bay` therefore compiled a pattern that
 * matched the page fine and then found no bucket, so the hit was dropped: the
 * term sat in the list, enabled, and silently never applied. Same for a tab, a
 * newline or a full-width space.
 */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
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
    // Folded to the one whitespace form the hit side uses — see
    // `collapseWhitespace`. Trimming alone (which is all `buildMatchKey` does)
    // left interior runs to break the lookup.
    .map((entry) => ({
      ...entry,
      source: normalize(collapseWhitespace(stripInvisible(entry.source))),
    }))
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
  const patternSource = `(?:${sources.map(termToPattern).join("|")})`
  const pattern = new RegExp(patternSource, "gi")
  /**
   * The same alternation, anchored (`y`) rather than scanning (`g`).
   *
   * Answers the one question `pattern` cannot — "what ELSE starts exactly
   * here?" — for the retry loop in `match`. A separate object rather than a
   * `lastIndex` borrow of `pattern`, which is mid-scan at that moment: parsing
   * the alternation twice measured ~2 ms at the 20,000-term cap (V8 defers the
   * codegen until a first `exec` that most pages never reach), and that is a
   * cheaper thing to spend than an invariant a later edit can quietly break.
   */
  const anchoredPattern = new RegExp(patternSource, "iy")

  return {
    size: usable.length,
    match(rawText: string): MatchedTerm[] {
      if (rawText === "") return []
      const text = normalize(rawText)

      /**
       * The entry a hit at `[start, start + matched.length)` stands for, or
       * `undefined` when nothing in the list claims it.
       *
       * Both rejections live here rather than in the pattern because neither
       * fits in one: a single regex cannot carry a per-branch case flag, and
       * `\b` is unusable across scripts (see `boundary.ts`).
       */
      const resolveAt = (start: number, matched: string): IndexedEntry | undefined => {
        // The hit may carry the page's whitespace (two spaces, a newline, a
        // non-breaking space) while the index is keyed on the single-spaced
        // term, so fold runs of whitespace back down before looking it up.
        const folded = matched.replace(/\s+/g, " ")
        const bucket = index.get(folded.toLowerCase())
        if (!bucket) {
          // The regex `i` flag's canonicalisation and String#toLowerCase are not
          // the same relation — Greek final sigma is the reachable case — so a
          // hit can miss the index. Rare enough to log rather than defend.
          logger.log("Glossary match had no index entry", { matched })
          return undefined
        }
        for (const entry of bucket) {
          if (entry.caseSensitive && entry.source !== folded) continue
          if (!isAtWordBoundary(text, start, start + matched.length, entry.boundary)) continue
          return entry
        }
        return undefined
      }

      const hits = new Map<string, MatchedTerm>()
      pattern.lastIndex = 0

      let match: RegExpExecArray | null = pattern.exec(text)
      while (match !== null) {
        const start = match.index
        let end = start + match[0].length
        let accepted = resolveAt(start, match[0])

        // A rejection does NOT mean "no term starts here".
        //
        // The alternation yields exactly ONE candidate per position — the
        // longest branch that matches, which is the only reason `sources` is
        // sorted longest-first, since JavaScript's `|` is leftmost-FIRST and not
        // leftmost-longest. The shorter terms that also start at `start` were
        // therefore never generated, and `lastIndex = start + 1` below would
        // abandon them unexamined: `Chort` is lost in `at Chort bayonet` because
        // `Chort Bay` matched there first and then failed its end boundary.
        //
        // So re-ask at the same position against a window one character too
        // short to hold the candidate just rejected, which forces the next one
        // out. `end` strictly decreases, so this terminates; it runs only after
        // a rejection, and the window is the span, not the paragraph.
        while (accepted === undefined) {
          anchoredPattern.lastIndex = 0
          const shorter = anchoredPattern.exec(text.slice(start, end - 1))
          if (shorter === null) break
          end = start + shorter[0].length
          accepted = resolveAt(start, shorter[0])
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
          pattern.lastIndex = end
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
