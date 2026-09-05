import { BATCH_SEPARATOR } from "@/utils/constants/prompt"

/**
 * Plain-text placeholder protocol for inline atoms (rendered formulas) in
 * bilingual page translation. An atom is replaced by `{{n}}` in the request
 * text; the translation comes back with the token moved to wherever the target
 * language puts the formula, and the DOM side clones the original element into
 * that position (see `dom/inline-atoms.ts`).
 *
 * This module is DOM-free on purpose: the content script encodes and decodes,
 * the background audits provider output before caching it, and the prompt
 * builder gates its placeholder rule on the same detector.
 *
 * ONE token grammar, shared by all four sides: what we emit, what we decode,
 * which literals we number around, and what the audit counts. Keeping them
 * identical is the invariant that makes the protocol safe — see
 * INLINE_ATOM_TOKEN_STRICT_RE.
 */
export const INLINE_ATOM_TOKEN_DELIMITERS = { open: "{{", close: "}}" } as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const STRICT_TOKEN_SOURCE = `${escapeRegExp(INLINE_ATOM_TOKEN_DELIMITERS.open)}(\\d+)${escapeRegExp(INLINE_ATOM_TOKEN_DELIMITERS.close)}`

/**
 * The one token grammar: exactly the shape we emit — digits only, no inner
 * whitespace.
 *
 * INVARIANT: the decoder, `nextFreeInlineAtomIndex` and `auditInlineAtomTokens`
 * must all match on THIS pattern. A decoder that accepts a spelling the
 * numbering scan does not reserve around will mistake page content for a
 * placeholder — it renders the formula over the literal and silently drops both
 * the literal and the token that was really ours.
 *
 * An earlier revision also decoded `[[n]]`, `⟦n⟧`, `｛｛n｝｝` and `〖n〗`, in case a
 * provider curled the brackets. A live probe of 739 requests (14 models across
 * 7 vendors, 6 target languages, tokens at every sentence position, up to ten
 * per segment, adjacent, quoted, and in batches) returned `{{n}}` verbatim
 * every time, so those spellings only ever fired on page text that happened to
 * look like a token. If a provider is ever caught mangling one, widen this
 * pattern — never the decoder alone.
 */
export const INLINE_ATOM_TOKEN_STRICT_RE = new RegExp(STRICT_TOKEN_SOURCE)

export function encodeInlineAtomToken(index: number): string {
  return `${INLINE_ATOM_TOKEN_DELIMITERS.open}${index}${INLINE_ATOM_TOKEN_DELIMITERS.close}`
}

/**
 * True when `text` carries at least one emitted-shape token. Used to gate the
 * LLM placeholder rule and the background cache audit, so a page that merely
 * mentions `{{input}}` or the `{{NO_TRANSLATION_NEEDED}}` sentinel never
 * triggers either.
 */
export function hasInlineAtomTokens(text: string): boolean {
  return INLINE_ATOM_TOKEN_STRICT_RE.test(text)
}

/**
 * First index that cannot collide with a token-shaped literal already present
 * in the prose (template docs print `{{0}}`-style text). Tokens are numbered
 * from this offset so a literal is never mistaken for an atom on decode — which
 * holds only while this scan and `decodeInlineAtomTokens` share one pattern.
 */
export function nextFreeInlineAtomIndex(text: string): number {
  let next = 0
  for (const match of text.matchAll(new RegExp(STRICT_TOKEN_SOURCE, "g"))) {
    next = Math.max(next, Number.parseInt(match[1]!, 10) + 1)
  }
  return next
}

export type DecodedInlineAtomPart =
  | { kind: "text"; text: string }
  | { kind: "atom"; index: number; raw: string }

/**
 * Split translated text into literal runs and tokens. Anything that is not
 * exactly a token stays text, so a `[[0]]` the page itself wrote survives the
 * round trip untouched. `raw` keeps the matched text so a caller can re-emit an
 * index we never issued verbatim instead of eating page content.
 */
export function decodeInlineAtomTokens(text: string): DecodedInlineAtomPart[] {
  const parts: DecodedInlineAtomPart[] = []
  let cursor = 0
  for (const match of text.matchAll(new RegExp(STRICT_TOKEN_SOURCE, "g"))) {
    const start = match.index ?? 0
    if (start > cursor) {
      parts.push({ kind: "text", text: text.slice(cursor, start) })
    }
    parts.push({ kind: "atom", index: Number.parseInt(match[1]!, 10), raw: match[0] })
    cursor = start + match[0].length
  }
  if (cursor < text.length) {
    parts.push({ kind: "text", text: text.slice(cursor) })
  }
  return parts
}

export interface InlineAtomTokenAudit {
  ok: boolean
  missing: number[]
  unknown: number[]
  duplicates: number[]
}

/**
 * Compare the tokens a request carried with the tokens its translation
 * returned. `ok` means the translation can be persisted: every token came back
 * exactly once and nothing was invented. The renderer still copes with a
 * failed audit (append missing, keep unknown literal); the audit only decides
 * whether the result deserves the cache.
 */
export function auditInlineAtomTokens(source: string, output: string): InlineAtomTokenAudit {
  const expected = new Set<number>()
  for (const match of source.matchAll(new RegExp(STRICT_TOKEN_SOURCE, "g"))) {
    expected.add(Number.parseInt(match[1]!, 10))
  }

  const seen = new Map<number, number>()
  for (const part of decodeInlineAtomTokens(output)) {
    if (part.kind === "atom") {
      seen.set(part.index, (seen.get(part.index) ?? 0) + 1)
    }
  }

  const missing = [...expected].filter((index) => !seen.has(index)).sort((a, b) => a - b)
  const unknown = [...seen.keys()].filter((index) => !expected.has(index)).sort((a, b) => a - b)
  const duplicates = [...seen.entries()]
    .filter(([index, count]) => expected.has(index) && count > 1)
    .map(([index]) => index)
    .sort((a, b) => a - b)

  return {
    ok: missing.length === 0 && unknown.length === 0 && duplicates.length === 0,
    missing,
    unknown,
    duplicates,
  }
}

// No worked example on purpose: a marker slot inside an example teaches models
// a base rate for emitting the marker (see the sentinel notes in
// utils/constants/prompt.ts).
export const INLINE_ATOM_TOKEN_SYSTEM_PROMPT = `## Protected Placeholder Rules
These mandatory rules override any conflicting instructions above:
1. A placeholder is \`${INLINE_ATOM_TOKEN_DELIMITERS.open}\` immediately followed by a number and \`${INLINE_ATOM_TOKEN_DELIMITERS.close}\`. It stands for an inline formula or symbol and is not text to translate.
2. Within each input segment (segments are separated by a standalone ${BATCH_SEPARATOR} line when present), copy every placeholder into that segment's output exactly once, character for character: same number, same brackets, no spaces inside.
3. Never translate, renumber, drop, add, merge, or reformat a placeholder. A placeholder may move within its segment to follow the target-language word order.`
