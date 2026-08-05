import type { LangCodeISO6393 } from "@read-frog/definitions"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import { getLanguageLabel, getLanguageName } from "@/utils/language-labels"

export interface LanguageItem<T extends LangCodeISO6393 | "auto" = LangCodeISO6393 | "auto"> {
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

export function filterLanguage(item: LanguageItem, query: string): boolean {
  const searchLower = query.toLowerCase()
  return (
    item.label.toLowerCase().includes(searchLower) ||
    (item.name?.toLowerCase().includes(searchLower) ?? false) ||
    item.value.toLowerCase().includes(searchLower)
  )
}
