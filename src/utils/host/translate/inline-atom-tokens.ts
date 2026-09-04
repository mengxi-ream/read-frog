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
 * ONE delimiter constant. The live provider probe decides the shipped syntax;
 * the decoder tolerates both candidate families regardless, so switching the
 * constant never orphans a cached translation.
 */
export const INLINE_ATOM_TOKEN_DELIMITERS = { open: "{{", close: "}}" } as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const STRICT_TOKEN_SOURCE = `${escapeRegExp(INLINE_ATOM_TOKEN_DELIMITERS.open)}(\\d+)${escapeRegExp(INLINE_ATOM_TOKEN_DELIMITERS.close)}`

/** Exactly the shape we emit: digits only, no inner whitespace. */
export const INLINE_ATOM_TOKEN_STRICT_RE = new RegExp(STRICT_TOKEN_SOURCE)

// Every bracket family a provider has been seen to substitute for the emitted
// one: fullwidth braces, mathematical white brackets and their ASCII/CJK
// look-alikes. Bare `[n]` is deliberately absent — arXiv prose is full of
// `[26]` citations.
const TOLERANT_OPEN = ["{{", "｛｛", "⟦", "[[", "〖"]
const TOLERANT_CLOSE = ["}}", "｝｝", "⟧", "]]", "〗"]
const TOLERANT_TOKEN_SOURCE = `(?:${TOLERANT_OPEN.map(escapeRegExp).join("|")})\\s*([0-9０-９]+)\\s*(?:${TOLERANT_CLOSE.map(escapeRegExp).join("|")})`

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
 * from this offset so a literal is never mistaken for an atom on decode.
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

function parseTokenIndex(digits: string): number {
  return Number.parseInt(digits.normalize("NFKC"), 10)
}

/**
 * Split translated text into literal runs and tokens. Tolerant by design:
 * providers curl brackets, insert spaces and use fullwidth digits; all of
 * those decode to the intended atom. `raw` keeps the exact matched text so a
 * caller can re-emit an unknown token verbatim instead of eating page text.
 */
export function decodeInlineAtomTokens(text: string): DecodedInlineAtomPart[] {
  const parts: DecodedInlineAtomPart[] = []
  let cursor = 0
  for (const match of text.matchAll(new RegExp(TOLERANT_TOKEN_SOURCE, "g"))) {
    const start = match.index ?? 0
    if (start > cursor) {
      parts.push({ kind: "text", text: text.slice(cursor, start) })
    }
    parts.push({ kind: "atom", index: parseTokenIndex(match[1]!), raw: match[0] })
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
