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
  // DeepL lists Filipino as Tagalog, `TL`, which it was always sent as.
  fil: "TL",
}

const DEEPL_SOURCE_CODES: Partial<Record<LanguageTag, string>> = {
  // Cantonese text was always sent to DeepL as Chinese, which DeepL reads.
  yue: "ZH",
  fil: "TL",
}

// The 38 languages the ISO 639-1 table used before tags had no code for. As a
// source, each went out as "auto" and the service worked the language out. A
// service answers a source language it does not list with HTTP 400, so as a
// source each is still left to the service, unless the service lists it. A
// target has nothing to fall back to and is always sent.
const DETECTED_BEFORE_TAGS: ReadonlySet<LanguageTag> = new Set<LanguageTag>([
  "mai",
  "bho",
  "ceb",
  "skr",
  "koi",
  "mag",
  "rn",
  "mg",
  "qug",
  "mad",
  "za",
  "ps",
  "hms",
  "hnj",
  "ilo",
  "haw",
  "nso",
  "fa-AF",
  "kab",
  "war",
  "pam",
  "hil",
  "bik",
  "min",
  "ace",
  "bug",
  "ban",
  "bjn",
  "mak",
  "sas",
  "tet",
  "niu",
  "tvl",
  "gil",
  "pau",
  "wls",
  "rar",
  "hif",
])

// Those of them each service lists: its published list and live requests,
// 2026-11. DeepL lists none of them.
const GOOGLE_LISTS: ReadonlySet<LanguageTag> = new Set<LanguageTag>([
  "mai",
  "bho",
  "ceb",
  "rn",
  "mg",
  "mad",
  "ps",
  "ilo",
  "haw",
  "nso",
  "fa-AF",
  "war",
  "pam",
  "hil",
  "bik",
  "min",
  "ace",
  "ban",
  "mak",
  "tet",
])
const MICROSOFT_LISTS: ReadonlySet<LanguageTag> = new Set<LanguageTag>([
  "mai",
  "bho",
  "mg",
  "ps",
  "nso",
  "fa-AF",
])

export function toGoogleLanguageCode(tag: LanguageTag): string {
  return GOOGLE_CODES[tag] ?? tag
}

export function toMicrosoftLanguageCode(tag: LanguageTag): string {
  return MICROSOFT_CODES[tag] ?? tag
}

/** What Google is told the text is in: "auto" to work it out itself. */
export function toGoogleSourceCode(tag: LanguageTag | "auto"): string {
  if (tag === "auto" || (DETECTED_BEFORE_TAGS.has(tag) && !GOOGLE_LISTS.has(tag))) return "auto"
  return toGoogleLanguageCode(tag)
}

/** What Microsoft is told the text is in: "auto" to work it out itself. */
export function toMicrosoftSourceCode(tag: LanguageTag | "auto"): string {
  if (tag === "auto" || (DETECTED_BEFORE_TAGS.has(tag) && !MICROSOFT_LISTS.has(tag))) {
    return "auto"
  }
  return toMicrosoftLanguageCode(tag)
}

/** DeepL's `source_lang`, or `undefined` to let DeepL work the language out. */
export function toDeepLSourceCode(tag: LanguageTag | "auto"): string | undefined {
  if (tag === "auto" || DETECTED_BEFORE_TAGS.has(tag)) return undefined
  return DEEPL_SOURCE_CODES[tag] ?? new Intl.Locale(tag).language.toUpperCase()
}

export function toDeepLTargetCode(tag: LanguageTag): string {
  return DEEPL_TARGET_CODES[tag] ?? new Intl.Locale(tag).language.toUpperCase()
}
