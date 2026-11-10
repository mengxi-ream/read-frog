import type { LanguageTag } from "@read-frog/definitions"

// What each translation service is sent for a language. Google and Microsoft
// take BCP 47 tags as they are, so their tables list only exceptions: the codes
// these languages were sent as before Read Frog keyed languages by tag (so the
// switch changes no request), and the services' own codes for a few languages.

const GOOGLE_CODES: Partial<Record<LanguageTag, string>> = {
  "zh-Hans": "zh",
  "zh-Hant": "zh-TW",
  "pt-BR": "pt",
  fil: "tl",
}

const MICROSOFT_CODES: Partial<Record<LanguageTag, string>> = {
  "zh-Hans": "zh",
  "zh-Hant": "zh-TW",
  "pt-BR": "pt",
  // Microsoft's `ku` is Central Kurdish (Sorani); its Kurmanji is `kmr`.
  ckb: "ku",
  // Microsoft keeps Dari as `prs`; it reads `fa-AF` as Iranian Persian.
  "fa-AF": "prs",
}

// DeepL writes codes in upper case and names a variety only for target
// languages that have one; a source language is the language alone.
const DEEPL_TARGET_CODES: Partial<Record<LanguageTag, string>> = {
  "zh-Hans": "ZH-HANS",
  "zh-Hant": "ZH-HANT",
  // DeepL has no Cantonese. Its readers read Traditional Chinese.
  yue: "ZH-HANT",
  "pt-BR": "PT-BR",
  "pt-PT": "PT-PT",
}

export function toGoogleLanguageCode(tag: LanguageTag): string {
  return GOOGLE_CODES[tag] ?? tag
}

export function toMicrosoftLanguageCode(tag: LanguageTag): string {
  return MICROSOFT_CODES[tag] ?? tag
}

export function toDeepLLanguageCode(tag: LanguageTag, direction: "source" | "target"): string {
  const targetCode = direction === "target" ? DEEPL_TARGET_CODES[tag] : undefined
  return targetCode ?? new Intl.Locale(tag).language.toUpperCase()
}
