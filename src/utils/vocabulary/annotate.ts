import { getWordRank } from "./word-rank"

// Tokens shorter than this are always treated as familiar — articles,
// pronouns and short function words are never worth annotating.
const MIN_WORD_LENGTH = 3

const WORD_PATTERN = /[a-z][a-z'-]*[a-z]|[a-z]/gi

export function normalizeWord(token: string): string {
  return token.toLowerCase()
}

/**
 * A word is "rare" when its frequency rank is beyond the user's familiar-word
 * threshold, or when it does not appear in the built-in list at all. Tokens
 * with an uppercase letter after the first character (acronyms, camelCase
 * identifiers) and capitalized tokens absent from the list (likely proper
 * nouns) are skipped.
 */
export function isRareWord(token: string, familiarWordRank: number): boolean {
  if (token.length < MIN_WORD_LENGTH) return false
  if (/[A-Z]/.test(token.slice(1))) return false
  const normalized = normalizeWord(token)
  const rank = getWordRank(normalized)
  if (rank !== undefined) return rank > familiarWordRank
  return token[0] === token[0].toLowerCase()
}

/** Unique normalized rare words across the given texts, in first-seen order. */
export function collectRareWords(
  texts: readonly string[],
  familiarWordRank: number,
  knownWords: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const text of texts) {
    for (const match of text.matchAll(WORD_PATTERN)) {
      const token = match[0]
      const normalized = normalizeWord(token)
      if (seen.has(normalized) || knownWords.has(normalized)) continue
      if (!isRareWord(token, familiarWordRank)) continue
      seen.add(normalized)
      result.push(normalized)
    }
  }
  return result
}

/**
 * Insert a parenthesized gloss after each first occurrence of a glossed word.
 * `annotated` tracks words already glossed earlier in the same run so a word
 * repeated across sibling text nodes is only annotated once.
 */
export function annotateText(
  text: string,
  glosses: ReadonlyMap<string, string>,
  annotated: Set<string>,
): string {
  return text.replace(WORD_PATTERN, (token) => {
    const normalized = normalizeWord(token)
    const gloss = glosses.get(normalized)
    if (!gloss || annotated.has(normalized)) return token
    annotated.add(normalized)
    return `${token}(${gloss})`
  })
}
