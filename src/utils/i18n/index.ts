import type { GeneratedI18nStructure } from "#i18n"
import type { UiLanguage } from "@/types/config/config"
import i18next from "i18next"
import { resolveUiLocale } from "./locale-map"
import { DEFAULT_UI_LOCALE, resources } from "./resources"

/**
 * Runtime-switchable i18n facade.
 *
 * Replaces `@wxt-dev/i18n`'s `browser.i18n.getMessage` resolution (hard-locked to the
 * browser UI language) with a single i18next instance whose language is driven by the
 * `uiLanguage` config field. Preserves the exact `i18n.t('key')` / `i18n.t('key', subs)`
 * call signature so ~800 existing call sites only change their import path.
 *
 *   config.uiLanguage ──resolveUiLocale──▶ i18next.language
 *        │ 'auto' → browser locale                     ▲
 *        │ explicit → passthrough                      │
 *        └───────── initI18n() / setUiLanguage() ──────┘
 *
 * Resources for all 9 locales are bundled, so `init`/`changeLanguage` complete
 * synchronously — the React `<LocaleBoundary>` relies on this to switch without a flash.
 */

type Substitution = string | number

/** Build an N-length tuple of `Substitution` (positional `$1..$9` → array of N values). */
type SubstitutionTuple<N extends number, Acc extends Substitution[] = []>
  = Acc["length"] extends N ? Acc : SubstitutionTuple<N, [...Acc, Substitution]>

export type I18nKey = keyof GeneratedI18nStructure

/**
 * Typed `t` for the facade. Keyed off WXT's generated positional `substitutions` count
 * only — it intentionally IGNORES WXT's `namedSubstitutions`. WXT flags the LLM
 * prompt-template keys (the repo's only `namedSubstitutions` keys) because its parser
 * matches the inner `{token}` of a literal `{{token}}`, but those tokens are NOT i18n
 * substitutions: they must survive verbatim to be filled later at prompt-execution time
 * (see `replaceSelectionToolbarCustomActionPromptTokens`). i18next leaves them intact via
 * `skipOnVariables`, so those keys correctly take no args here.
 */
type FacadeT = <K extends I18nKey>(
  key: K,
  ...args: GeneratedI18nStructure[K]["substitutions"] extends 0
    ? []
    : [substitutions: SubstitutionTuple<GeneratedI18nStructure[K]["substitutions"]>]
) => string

let initialized = false

const I18NEXT_OPTIONS = {
  resources,
  fallbackLng: DEFAULT_UI_LOCALE,
  supportedLngs: false as const, // we always pass a resolved, supported locale
  keySeparator: ".",
  nsSeparator: false as const,
  // Preserve the pre-migration `browser.i18n.getMessage` behaviour of returning "" for
  // a key missing in *all* locales, so guards like `i18n.t(key) || fallback` keep working.
  parseMissingKeyHandler: () => "",
  interpolation: {
    escapeValue: false,
    // Leave `{{token}}` untouched when no matching value is passed. This keeps literal
    // prompt-template tokens (`{{selection}}` etc.) intact so `i18n.t(key)` with no args
    // returns them verbatim for later filling. (Default true in i18next 26; pinned here.)
    skipOnVariables: true,
  },
  initImmediate: false as const,
} as const

/**
 * Initialize the i18next singleton for the current JS context. Call once per entrypoint
 * (background, popup, options, each content script) after config is loaded, before render.
 * Idempotent — a second call just switches the language if it differs.
 */
export async function initI18n(uiLanguage: UiLanguage = "auto"): Promise<void> {
  const lng = resolveUiLocale(uiLanguage)
  if (initialized) {
    if (i18next.language !== lng) {
      await i18next.changeLanguage(lng)
    }
    return
  }
  initialized = true
  await i18next.init({ ...I18NEXT_OPTIONS, lng })
}

/** Switch the active UI language (synchronous with bundled resources). */
export async function setUiLanguage(uiLanguage: UiLanguage): Promise<void> {
  await i18next.changeLanguage(resolveUiLocale(uiLanguage))
}

/**
 * Delegate for every `i18n.t(...)` call. Positional substitutions (`$1..$9`, converted to
 * `{{0}}..{{8}}` at resource-load time) arrive as an array and map to i18next's
 * interpolation object. No key uses plurals or named substitutions, so no other arg
 * shapes exist.
 */
function rawT(key: string, substitutions?: Substitution[]): string {
  const options = substitutions
    ? Object.fromEntries(substitutions.map((value, index) => [String(index), value]))
    : undefined
  return i18next.t(key, options)
}

export const i18n: { t: FacadeT } = { t: rawT as FacadeT }
