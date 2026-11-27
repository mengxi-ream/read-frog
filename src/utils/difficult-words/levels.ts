import type { VocabLang, VocabLevel } from "@read-frog/api-contract"
import { getUiLocale, i18n } from "@/utils/i18n"
import { getLanguageName } from "@/utils/language-labels"

/**
 * A language words are judged in, as the reader reads it. Portuguese is one
 * list under `pt-BR`, European Portuguese judged with it, so its level is
 * named for both.
 */
export function getVocabLanguageName(lang: VocabLang) {
  if (lang !== "pt-BR") return getLanguageName(lang)
  try {
    return (
      new Intl.DisplayNames([getUiLocale()], { type: "language" }).of("pt") ?? getLanguageName(lang)
    )
  } catch {
    return getLanguageName(lang)
  }
}

/** A reading level's name: the CEFR's own, or "Not sure". */
export function getLevelLabel(level: VocabLevel) {
  return level === "unsure" ? i18n.t("difficultWords.level.unsure") : level
}

/** What one reads at a level, in the CEFR's reading self-assessment terms. */
export function getLevelDescription(level: VocabLevel) {
  return i18n.t(`difficultWords.level.descriptions.${level}` as never)
}
