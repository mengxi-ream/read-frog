/// <reference types="@modyfi/vite-plugin-yaml/modules" />
import type { Resource } from "i18next"
import en from "@/locales/en.yml"
import es from "@/locales/es.yml"
import ja from "@/locales/ja.yml"
import ko from "@/locales/ko.yml"
import ru from "@/locales/ru.yml"
import tr from "@/locales/tr.yml"
import vi from "@/locales/vi.yml"
import zhCN from "@/locales/zh-CN.yml"
import zhTW from "@/locales/zh-TW.yml"

/**
 * The interface languages the runtime i18next engine can switch between.
 *
 * MUST stay in sync with the `uiLanguage` enum in `@/types/config/config` and the
 * files under `src/locales/`. `@wxt-dev/i18n/module` still reads those same files to
 * emit `_locales/*` for manifest name/description localization (browser-locale-bound).
 */
export const SUPPORTED_UI_LOCALES = [
  "en",
  "es",
  "ja",
  "ko",
  "ru",
  "tr",
  "vi",
  "zh-CN",
  "zh-TW",
] as const

export type SupportedUiLocale = (typeof SUPPORTED_UI_LOCALES)[number]

export const DEFAULT_UI_LOCALE: SupportedUiLocale = "en"

interface LocaleTree { [key: string]: string | LocaleTree }

/**
 * Convert WXT-style positional substitutions to i18next interpolation, applied to
 * every string leaf at build time:
 *   - `$$`      → literal `$`   (WXT escape; none currently in the YAML, handled anyway)
 *   - `$1`..`$9`→ `{{0}}`..`{{8}}` (0-indexed to match the facade's array mapping)
 *
 * Intentionally left untouched:
 *   - existing named tokens like `{{targetLanguage}}` (LLM prompt templates; no `$`)
 *   - Chrome context-menu placeholders like `%s`
 */
function convertPlaceholders(value: string): string {
  return value.replace(/\$\$|\$(\d)/g, (_match, digit: string | undefined) =>
    digit === undefined ? "$" : `{{${Number(digit) - 1}}}`)
}

function convertTree(node: LocaleTree): LocaleTree {
  const out: LocaleTree = {}
  for (const [key, val] of Object.entries(node)) {
    out[key] = typeof val === "string" ? convertPlaceholders(val) : convertTree(val)
  }
  return out
}

const rawResources: Record<SupportedUiLocale, LocaleTree> = {
  "en": en,
  "es": es,
  "ja": ja,
  "ko": ko,
  "ru": ru,
  "tr": tr,
  "vi": vi,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
}

/**
 * i18next resource bundle: `{ [locale]: { translation: <nested string tree> } }`.
 * Single default namespace ("translation"); keys are traversed with keySeparator ".".
 */
export const resources: Resource = Object.fromEntries(
  Object.entries(rawResources).map(([lng, tree]) => [
    lng,
    { translation: convertTree(tree) },
  ]),
)
