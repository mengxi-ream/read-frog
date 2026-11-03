import type { VocabLevel } from "@read-frog/api-contract"
import { i18n } from "@/utils/i18n"

/** A reading level's name: the CEFR's own, or "Not sure". */
export function getLevelLabel(level: VocabLevel) {
  return level === "unsure" ? i18n.t("difficultWords.level.unsure") : level
}

/** What one reads at a level, in the CEFR's reading self-assessment terms. */
export function getLevelDescription(level: VocabLevel) {
  return i18n.t(`difficultWords.level.descriptions.${level}` as never)
}
