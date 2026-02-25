import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { getFinalSourceCode } from "@/utils/config/languages"
import { matchDomainPattern } from "@/utils/url"

export async function shouldEnableAutoTranslation(url: string, detectedCodeOrUnd: LangCodeISO6393 | "und", config: Config): Promise<boolean> {
  const autoTranslatePatterns = config?.translate.page.autoTranslatePatterns
  const autoTranslateLanguages = config?.translate.page.autoTranslateLanguages
  const { sourceCode } = config?.language || {}

  const doesMatchPattern = autoTranslatePatterns?.some(pattern =>
    matchDomainPattern(url, pattern),
  ) ?? false

  let doesMatchLanguage = false
  if (detectedCodeOrUnd !== "und") {
    doesMatchLanguage = autoTranslateLanguages?.includes(getFinalSourceCode(sourceCode, detectedCodeOrUnd))
  }

  return doesMatchPattern || doesMatchLanguage
}
