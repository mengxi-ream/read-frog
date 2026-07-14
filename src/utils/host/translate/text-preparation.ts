const INVISIBLE_TRANSLATION_CHARACTERS_REGEX = /[\u200B-\u200D\uFEFF]/g

export function prepareTranslationText(value: string | null | undefined): string {
  return value?.replace(INVISIBLE_TRANSLATION_CHARACTERS_REGEX, "").trim() ?? ""
}

// NFKC has no compatibility decomposition for curly quotes, so they need
// explicit folding (includes the low-9 variants).
const SMART_SINGLE_QUOTES_REGEX = /[\u2018\u2019\u201A\u201B]/g
const SMART_DOUBLE_QUOTES_REGEX = /[\u201C\u201D\u201E\u201F]/g
const WHITESPACE_RUN_REGEX = /\s+/g

/**
 * Normalization for source-vs-translation equality checks ONLY \u2014 never for
 * text that is displayed, sent to a provider, or hashed for the cache.
 *
 * LLMs echo same-language input with cosmetic drift (whitespace reflow, NBSP,
 * smart quotes, ellipsis, fullwidth punctuation, casing). Equality after this
 * folding means the "translation" carries no information and should be hidden.
 */
export function normalizeForComparison(value: string | null | undefined): string {
  return prepareTranslationText(value)
    .normalize("NFKC")
    .replace(SMART_SINGLE_QUOTES_REGEX, "'")
    .replace(SMART_DOUBLE_QUOTES_REGEX, '"')
    .replace(WHITESPACE_RUN_REGEX, " ")
    .toLowerCase()
    .trim()
}
