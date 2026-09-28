// The UI locale list on its own, so code that only needs to know which
// languages exist does not load every translation (resources.ts imports all
// the locale files).

/**
 * The interface languages the runtime i18next engine can switch between.
 *
 * MUST stay in sync with the `uiLanguage` enum in `@/types/config/config` and the
 * files under `src/locales/`. `@wxt-dev/i18n/module` still reads those same files to
 * emit `_locales/*` for manifest name/description localization (browser-locale-bound).
 */
export const SUPPORTED_UI_LOCALES = [
  // Chrome ignores _locales/az; our i18next UI still supports manual switching.
  // "Auto" follows the browser UI language. Keep native default_locale as "en"
  // and use the i18next facade for UI strings, not browser.i18n.getMessage().
  // https://developer.chrome.com/docs/extensions/reference/api/i18n#locales
  "az",
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
