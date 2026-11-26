import type { Config } from "@/types/config/config"
import { isSameLanguage } from "@read-frog/definitions"
import { detectLanguage } from "@/utils/content/language"
import { prepareTranslationText } from "./text-preparation"

export const MIN_LENGTH_FOR_TARGET_LANG_DETECTION = 50

/**
 * Local franc-based check for text that is already in the target language.
 *
 * Runs BEFORE any wrapper/spinner DOM insertion: detection is pure synchronous
 * CPU (`enableLLM: false` is deliberate), so same-language paragraphs can be
 * skipped without the insert-then-remove DOM churn and spinner flash they
 * previously paid. Texts under the length threshold are never skipped — franc
 * is unreliable on short input.
 */
export async function shouldSkipAsTargetLanguage(text: string, config: Config): Promise<boolean> {
  if (!config.pageTranslation.page.enableTargetLanguageSkip) return false
  const prepared = prepareTranslationText(text)
  if (prepared.length < MIN_LENGTH_FOR_TARGET_LANG_DETECTION) return false
  const detected = await detectLanguage(prepared, { enableLLM: false })
  // Regions do not count: franc reads European Portuguese as `pt-BR`, and a
  // `pt-PT` reader needs neither translated.
  return detected !== null && isSameLanguage(detected, config.language.targetCode)
}
