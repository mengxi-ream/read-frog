import type { GlossaryEntry } from "./types"
import { urlMatchesPattern } from "../url-pattern"

/** The parts of a glossary that decide whether it applies to a page. */
export interface GlossaryScope {
  enabled: boolean
  matchPatterns: readonly string[]
}

/**
 * Whether `glossary` applies to `url`.
 *
 * An empty pattern list means every site — the list restricts, it does not
 * permit — so a glossary works as soon as it is created.
 *
 * `url` is undefined where there is no page to speak of: the background
 * resolving a prompt it was not handed terms for, or an extension page. A
 * glossary scoped to particular sites must NOT leak into those, so only the
 * unscoped ones apply there. An unparseable or non-http URL simply matches no
 * pattern and lands in the same place.
 */
export function isGlossaryActiveForUrl(glossary: GlossaryScope, url: string | undefined): boolean {
  if (!glossary.enabled) return false
  if (glossary.matchPatterns.length === 0) return true
  if (url === undefined) return false
  return glossary.matchPatterns.some((pattern) => urlMatchesPattern(url, pattern))
}

/**
 * Flatten several glossaries' terms into the one list the matcher compiles.
 *
 * `orderedGroups` must be in list order — oldest glossary first. Where two
 * glossaries claim the same `matchKey`, THE LATER ONE WINS: a glossary added to
 * override an older one does, and the rule is legible from the screen because
 * the list is shown in that same order. The term reaches the prompt once either
 * way; sending both wordings would just hand the model a contradiction.
 *
 * A case-sensitive and a case-insensitive entry for the same word carry
 * different `matchKey`s, so both survive — that is not a conflict, and the
 * matcher already prefers the case-sensitive one where both could hit.
 */
export function mergeGlossaryTerms(
  orderedGroups: readonly (readonly GlossaryEntry[])[],
): GlossaryEntry[] {
  const byMatchKey = new Map<string, GlossaryEntry>()
  for (const group of orderedGroups) {
    for (const entry of group) {
      byMatchKey.set(entry.matchKey, entry)
    }
  }
  return [...byMatchKey.values()]
}
