import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GlossaryTargetLang } from "@/utils/glossary/target-language"
import { LANG_CODE_TO_LOCALE_NAME } from "@read-frog/definitions"
import { camelCase } from "case-anything"
import { ALL_LANGUAGES } from "@/utils/glossary/target-language"
import { i18n } from "@/utils/i18n"

export function getLanguageName(code: LangCodeISO6393) {
  return i18n.t(`languages.${camelCase(code)}` as never)
}

export function getLanguageLabel(code: LangCodeISO6393) {
  return `${getLanguageName(code)} (${LANG_CODE_TO_LOCALE_NAME[code]})`
}

/**
 * A glossary term's target language as the user reads it.
 *
 * Lives beside the other two because the question is the same one — how a
 * language value becomes text on screen — and because keeping the branch here
 * is what lets every call site render `term.targetLang` without one.
 */
export function getGlossaryTargetLangLabel(value: GlossaryTargetLang): string {
  return value === ALL_LANGUAGES
    ? i18n.t("options.advanced.glossary.allLanguages")
    : getLanguageName(value)
}
