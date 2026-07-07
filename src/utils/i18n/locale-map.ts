import type { SupportedUiLocale } from "./resources"
import type { UiLanguage } from "@/types/config/config"
import { browser } from "#imports"
import { DEFAULT_UI_LOCALE, SUPPORTED_UI_LOCALES } from "./resources"

const SUPPORTED = new Set<string>(SUPPORTED_UI_LOCALES)

// Regions written in Traditional Chinese; everything else zh-* falls back to Simplified.
const TRADITIONAL_CHINESE_REGIONS = new Set(["tw", "hk", "mo", "hant"])

/**
 * Resolve the stored `uiLanguage` config value to a concrete supported locale.
 *
 * - explicit locale (e.g. "ja", "zh-TW") → passed through
 * - "auto" → nearest match for the browser UI language:
 *     zh-*  → zh-TW (traditional regions) or zh-CN
 *     exact → e.g. "es" stays "es"
 *     prefix→ e.g. "en-US" → "en", "pt-BR" → (no match) → "en"
 *     else  → "en"
 *
 * Guarded so it degrades to "en" when `browser.i18n` is unavailable (e.g. tests).
 */
export function resolveUiLocale(uiLanguage: UiLanguage): SupportedUiLocale {
  if (uiLanguage !== "auto") {
    return uiLanguage
  }
  return resolveBrowserLocale()
}

function resolveBrowserLocale(): SupportedUiLocale {
  let uiLanguage: string
  try {
    // e.g. "en-US", "zh-CN", "ja"
    uiLanguage = browser.i18n.getUILanguage()
  }
  catch {
    return DEFAULT_UI_LOCALE
  }

  const lower = uiLanguage.toLowerCase()
  const [prefix, region] = lower.split("-")

  if (prefix === "zh") {
    return region && TRADITIONAL_CHINESE_REGIONS.has(region) ? "zh-TW" : "zh-CN"
  }

  // Exact match against a supported locale (case-insensitive).
  const exact = SUPPORTED_UI_LOCALES.find(locale => locale.toLowerCase() === lower)
  if (exact) {
    return exact
  }

  // Prefix match: "en-US" → "en".
  if (SUPPORTED.has(prefix)) {
    return prefix as SupportedUiLocale
  }

  return DEFAULT_UI_LOCALE
}
