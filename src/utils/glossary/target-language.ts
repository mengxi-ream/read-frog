import type { LangCodeISO6393 } from "@read-frog/definitions"

/**
 * The value a term carries when its wording is not written for any one
 * language — the keep-the-original case, which is #942's first ask.
 *
 * A three-letter string sitting where a language code sits, so it must not BE
 * one: the extension translates into a curated 179 of ISO 639-3, and `all`
 * (Allar) is not among them. A test asserts that, because the guarantee is the
 * language list's to keep, not this file's.
 */
export const ALL_LANGUAGES = "all"

/** Which target language a term's wording is for, or every language. */
export type GlossaryTargetLang = LangCodeISO6393 | typeof ALL_LANGUAGES

/** Whether a term written for `termLang` belongs in a prompt targeting `pageLang`. */
export function appliesToLanguage(
  termLang: GlossaryTargetLang,
  pageLang: LangCodeISO6393,
): boolean {
  return termLang === ALL_LANGUAGES || termLang === pageLang
}

/**
 * Sort key that puts the language-independent rows FIRST.
 *
 * `mergeGlossaryTerms` collapses by `matchKey` with the later entry winning, so
 * "sorted first" means "overridden". That makes "a wording written for this
 * language beats the one written for every language" a consequence of this one
 * line rather than a second rule anybody has to remember — and it stays inside
 * a single glossary's own group, so the cross-glossary order (D3, the later
 * glossary wins) is untouched.
 */
export function targetLangPrecedence(termLang: GlossaryTargetLang): number {
  return termLang === ALL_LANGUAGES ? 0 : 1
}

/**
 * What a new term's target language should be before the user says otherwise.
 *
 * A wording belongs to the language it was written in — a Chinese rendering has
 * no business in a Japanese prompt, which is why the field exists at all. A term
 * with NO wording is an instruction to leave the text alone, and that is true in
 * every language; filing it under one means it silently stops firing the day the
 * user switches target language.
 */
export function defaultGlossaryTargetLang(
  target: string,
  current: LangCodeISO6393,
): GlossaryTargetLang {
  return target.trim() === "" ? ALL_LANGUAGES : current
}
