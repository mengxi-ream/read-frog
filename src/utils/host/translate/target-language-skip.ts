import type { Config } from "@/types/config/config"
import { detectLanguage } from "@/utils/content/language"
import { prepareTranslationText } from "./text-preparation"

export const MIN_LENGTH_FOR_TARGET_LANG_DETECTION = 50

const MIN_HAN_CHARACTERS_FOR_SHORT_DETECTION = 10
const MIN_HAN_LETTER_RATIO = 0.8
const HAN_LETTER_REGEX = /\p{Script=Han}/u
const CHINESE_OR_LATIN_LETTER_REGEX = /[\p{Script=Han}\p{Script=Latin}]/u
const LATIN_PHRASE_REGEX = /\p{Script=Latin}+[\s\p{P}]+\p{Script=Latin}+/u

function hasShortChineseProse(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? []
  const hanCount = letters.filter((letter) => HAN_LETTER_REGEX.test(letter)).length

  // Count letters, not punctuation/digits/emoji. Permit a small Latin acronym
  // such as REA or CC, but keep other scripts and Latin phrases translatable.
  return (
    hanCount >= MIN_HAN_CHARACTERS_FOR_SHORT_DETECTION &&
    hanCount / letters.length >= MIN_HAN_LETTER_RATIO &&
    letters.every((letter) => CHINESE_OR_LATIN_LETTER_REGEX.test(letter)) &&
    !LATIN_PHRASE_REGEX.test(text)
  )
}

/**
 * Local franc-based check for text that is already in the target language.
 *
 * Runs BEFORE any wrapper/spinner DOM insertion: detection is pure synchronous
 * CPU (`enableLLM: false` is deliberate), so same-language paragraphs can be
 * skipped without the insert-then-remove DOM churn and spinner flash they
 * previously paid. Keep the length threshold for ambiguous short input, but
 * allow Han-dominant Chinese prose with enough actual letters: franc identifies
 * Chinese by script rather than the unreliable short-input Latin trigrams.
 */
export async function shouldSkipAsTargetLanguage(text: string, config: Config): Promise<boolean> {
  if (!config.pageTranslation.page.enableTargetLanguageSkip) return false
  const prepared = prepareTranslationText(text)
  if (
    prepared.length < MIN_LENGTH_FOR_TARGET_LANG_DETECTION &&
    (config.language.targetCode !== "cmn" || !hasShortChineseProse(prepared))
  ) {
    return false
  }
  const detected = await detectLanguage(prepared, { enableLLM: false })
  return detected === config.language.targetCode
}
