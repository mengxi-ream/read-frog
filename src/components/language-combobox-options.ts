import type { LangCodeISO6393 } from "@read-frog/definitions"
import { i18n } from "#imports"
import {
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from "@read-frog/definitions"
import { camelCase } from "case-anything"

export interface LanguageItem<T extends LangCodeISO6393 | "auto" = LangCodeISO6393 | "auto"> {
  value: T
  label: string
  name: string
}

export function getLanguageName(code: LangCodeISO6393) {
  return i18n.t(`languages.${camelCase(code)}` as Parameters<typeof i18n.t>[0])
}

export function getLanguageLabel(code: LangCodeISO6393) {
  return `${getLanguageName(code)} (${LANG_CODE_TO_LOCALE_NAME[code]})`
}

export function getTargetLanguageItems(): LanguageItem<LangCodeISO6393>[] {
  return langCodeISO6393Schema.options.map(code => ({
    value: code,
    label: getLanguageLabel(code),
    name: getLanguageName(code),
  }))
}

export function getLanguageItems(detectedLangCode?: LangCodeISO6393): LanguageItem[] {
  const items: LanguageItem[] = getTargetLanguageItems()

  if (detectedLangCode) {
    items.unshift({
      value: "auto",
      label: getLanguageLabel(detectedLangCode),
      name: getLanguageName(detectedLangCode),
    })
  }

  return items
}

export function filterLanguage(item: LanguageItem, query: string): boolean {
  const searchLower = query.toLowerCase()
  return item.label.toLowerCase().includes(searchLower)
    || item.name.toLowerCase().includes(searchLower)
    || item.value.toLowerCase().includes(searchLower)
}
