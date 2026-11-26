import type { LanguageTag } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { isSameLanguage } from "@read-frog/definitions"
import { getFinalSourceCode } from "@/utils/config/languages"
import { urlMatchesPattern } from "@/utils/url-pattern"

export async function shouldEnableAutoTranslation(
  url: string,
  detectedCodeOrUnd: LanguageTag | "und",
  config: Config,
): Promise<boolean> {
  const autoTranslatePatterns = config?.pageTranslation.page.autoTranslatePatterns
  const neverAutoTranslatePatterns = config?.pageTranslation.page.neverAutoTranslatePatterns
  const autoTranslateLanguages = config?.pageTranslation.page.autoTranslateLanguages
  const { sourceCode } = config?.language || {}

  const doesMatchNeverTranslatePattern =
    neverAutoTranslatePatterns?.some((pattern) => urlMatchesPattern(url, pattern)) ?? false
  if (doesMatchNeverTranslatePattern) {
    return false
  }

  const doesMatchPattern =
    autoTranslatePatterns?.some((pattern) => urlMatchesPattern(url, pattern)) ?? false

  let doesMatchLanguage = false
  if (detectedCodeOrUnd !== "und") {
    const pageLanguage = getFinalSourceCode(sourceCode, detectedCodeOrUnd)
    doesMatchLanguage =
      autoTranslateLanguages?.some((language) => isSameLanguage(language, pageLanguage)) ?? false
  }

  return doesMatchPattern || doesMatchLanguage
}
