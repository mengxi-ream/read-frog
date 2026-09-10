import { INVISIBLE_TRANSLATION_CHARACTERS_REGEX } from "../host/translate/text-preparation"

/**
 * The identity of a glossary entry: its source text plus whether that text is
 * matched case-sensitively. Two entries agreeing on both ARE the same term, so
 * this is what import dedupes on and what a cross-device merge reconciles on.
 *
 * The case flag is part of the key on purpose: `Go` (case-sensitive, the
 * language) and `go` (case-insensitive) are different entries and must be able
 * to coexist. A key folded without it would reject the second one.
 */
export function buildMatchKey(source: string, caseSensitive: boolean): string {
  // Zero-width characters and normalisation form are stripped here for the same
  // reason the matcher strips them: two terms that look identical must BE
  // identical, or the user gets two rows they cannot tell apart and only one of
  // them ever matches.
  const trimmed = source.replace(INVISIBLE_TRANSLATION_CHARACTERS_REGEX, "").normalize("NFC").trim()
  return caseSensitive ? `s:${trimmed}` : `i:${trimmed.toLowerCase()}`
}
