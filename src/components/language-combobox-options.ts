import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GlossaryTargetLang } from "@/utils/glossary/target-language"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import { ALL_LANGUAGES } from "@/utils/glossary/target-language"
import { getLanguageLabel, getLanguageName } from "@/utils/language-labels"

/**
 * `T` is only constrained to `string` so a surface can offer a row that is not a
 * language — `auto` below, `all` for the glossary. Every such row is pinned
 * ahead of the languages and named by its caller.
 */
export interface LanguageItem<T extends string = LangCodeISO6393 | "auto"> {
  value: T
  label: string
  name?: string
}

export function getTargetLanguageItems(): LanguageItem<LangCodeISO6393>[] {
  return langCodeISO6393Schema.options.map((code) => ({
    value: code,
    label: getLanguageLabel(code),
    name: getLanguageName(code),
  }))
}

/**
 * `detectedLangCode` names the auto row after what the page turned out to be — for surfaces
 * that sit beside a page. `autoLabel` is for surfaces that have no page to resolve against
 * (the settings page), where auto can only be described.
 */
export function getLanguageItems(
  detectedLangCode?: LangCodeISO6393,
  autoLabel?: string,
): LanguageItem[] {
  const items: LanguageItem[] = getTargetLanguageItems()

  if (detectedLangCode) {
    items.unshift({
      value: "auto",
      label: getLanguageLabel(detectedLangCode),
      name: getLanguageName(detectedLangCode),
    })
  } else if (autoLabel) {
    items.unshift({ value: "auto", label: autoLabel })
  }

  return items
}

/**
 * The languages a glossary term can be written for, with "every language" pinned
 * first — the value a term carries when its wording is language-independent.
 *
 * Deliberately NOT a variant of `getLanguageItems`: a glossary has no page to
 * detect a language from, and offering `auto` beside `all` would put two rows
 * that both mean "not a specific language" next to each other.
 */
export function getGlossaryTargetLanguageItems(
  allLabel: string,
): LanguageItem<GlossaryTargetLang>[] {
  return [{ value: ALL_LANGUAGES, label: allLabel }, ...getTargetLanguageItems()]
}

export function filterLanguage(item: LanguageItem<string>, query: string): boolean {
  const searchLower = query.toLowerCase()
  return (
    item.label.toLowerCase().includes(searchLower) ||
    (item.name?.toLowerCase().includes(searchLower) ?? false) ||
    item.value.toLowerCase().includes(searchLower)
  )
}
