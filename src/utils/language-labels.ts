import type { LanguageTag } from "@read-frog/definitions"
import type { GlossaryTargetLang } from "@/utils/glossary/target-language"
import {
  getLanguageDisplayName,
  getLanguageEndonym,
  languageTagSchema,
} from "@read-frog/definitions"
import { ALL_LANGUAGES } from "@/utils/glossary/target-language"
import { getUiLocale, i18n } from "@/utils/i18n"

// Names come from @read-frog/definitions' table for the interface language, so
// no locale file has to list every language and every browser shows the same
// names.
export function getLanguageName(code: LanguageTag) {
  return getLanguageDisplayName(code, getUiLocale())
}

export function getLanguageLabel(code: LanguageTag) {
  return `${getLanguageName(code)} (${getLanguageEndonym(code)})`
}

/**
 * A glossary term's target language as the user reads it.
 *
 * Lives beside the other two because the question is the same one — how a
 * language value becomes text on screen — and because keeping the branch here
 * is what lets every call site render `term.targetLang` without one.
 */
export function getGlossaryTargetLangLabel(value: GlossaryTargetLang): string {
  if (value === ALL_LANGUAGES) return i18n.t("options.advanced.glossary.allLanguages")
  // A stored term can carry a language this build does not list — a newer
  // build's, or one from an imported file, which `normalizeStoredTargetLang`
  // keeps as it is. Shown as stored, since it has no name here.
  return languageTagSchema.safeParse(value).success ? getLanguageName(value) : value
}
