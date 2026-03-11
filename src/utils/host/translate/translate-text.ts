import type { LangCodeISO6393, LangLevel } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { LANG_CODE_TO_EN_NAME, LANG_CODE_TO_LOCALE_NAME } from "@read-frog/definitions"
import { franc } from "franc"
import { toast } from "sonner"
import { isAPIProviderConfig, isLLMProviderConfig } from "@/types/config/provider"
import { getProviderConfigById } from "@/utils/config/helpers"
import { detectLanguage } from "@/utils/content/language"
import { logger } from "@/utils/logger"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { Sha256Hex } from "../../hash"
import { sendMessage } from "../../message"

const MIN_LENGTH_FOR_LANG_DETECTION = 50
// Minimum text length for skip language detection (shorter than general detection
// to catch short phrases like "Bonjour!" or "こんにちは")
export const MIN_LENGTH_FOR_SKIP_LLM_DETECTION = 10

/**
 * Check if text should be skipped based on language detection.
 * Uses LLM detection if enabled, falls back to franc library.
 * @param text - Text to detect language for
 * @param skipLanguages - List of languages to skip translation for
 * @param enableLLMDetection - Whether to use LLM for language detection
 * @param providerConfig - Provider configuration for LLM detection
 * @returns true if text language is in skipLanguages list (should skip translation)
 */
export async function shouldSkipByLanguage(
  text: string,
  skipLanguages: LangCodeISO6393[],
  enableLLMDetection: boolean,
  providerConfig: ProviderConfig,
): Promise<boolean> {
  const isLLMProvider = isLLMProviderConfig(providerConfig)
  const detectedLang = await detectLanguage(text, {
    minLength: MIN_LENGTH_FOR_SKIP_LLM_DETECTION,
    enableLLM: enableLLMDetection && isLLMProvider,
    providerConfig: isLLMProvider ? providerConfig : undefined,
  })

  if (!detectedLang) {
    return false
  }

  return skipLanguages.includes(detectedLang)
}

export async function buildHashComponents(
  text: string,
  providerConfig: ProviderConfig,
  partialLangConfig: { sourceCode: LangCodeISO6393 | "auto", targetCode: LangCodeISO6393 },
  enableAIContentAware: boolean,
  articleContext?: { title?: string | null, textContent?: string | null },
): Promise<string[]> {
  const hashComponents = [
    text,
    JSON.stringify(providerConfig),
    // don't include detectedCode because it may change after the page is translated, i.e. it's not accurate
    partialLangConfig.sourceCode,
    partialLangConfig.targetCode,
  ]

  if (isLLMProviderConfig(providerConfig)) {
    const targetLangName = LANG_CODE_TO_EN_NAME[partialLangConfig.targetCode]
    const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, text, { isBatch: true })
    hashComponents.push(systemPrompt, prompt)
    hashComponents.push(enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false")

    // Include article context in hash when AI Content Aware is enabled
    // to ensure when we get different content from the same url, we get different cache entries
    if (enableAIContentAware && articleContext) {
      if (articleContext.title) {
        hashComponents.push(`title:${articleContext.title}`)
      }
      if (articleContext.textContent !== undefined && articleContext.textContent !== null) {
        // Use a substring hash to avoid huge hash inputs while still differentiating articles
        hashComponents.push(`content:${articleContext.textContent.slice(0, 1000)}`)
      }
    }
  }

  return hashComponents
}

export interface TranslateTextOptions {
  text: string
  langConfig: { sourceCode: LangCodeISO6393 | "auto", targetCode: LangCodeISO6393, level: LangLevel }
  providerConfig: ProviderConfig
  enableAIContentAware?: boolean
  extraHashTags?: string[]
  articleContext?: { title?: string | null, textContent?: string | null }
}

/**
 * Core translation function — pure, zero config fetching.
 * All dependencies must be provided explicitly.
 */
export async function translateTextCore(options: TranslateTextOptions): Promise<string> {
  const {
    text,
    langConfig,
    providerConfig,
    enableAIContentAware = false,
    extraHashTags = [],
    articleContext,
  } = options

  // Skip translation if text is already in target language
  if (text.length >= MIN_LENGTH_FOR_LANG_DETECTION) {
    const detectedLang = franc(text)
    if (detectedLang === langConfig.targetCode) {
      logger.info(`translateTextCore: skipping translation because text is already in target language. text: ${text}`)
      return ""
    }
  }

  // Get article data for LLM providers (needed for both hash and request)
  let articleTitle: string | null | undefined
  let articleTextContent: string | null | undefined

  if (isLLMProviderConfig(providerConfig) && articleContext) {
    articleTitle = articleContext.title
    articleTextContent = articleContext.textContent
  }

  const hashComponents = await buildHashComponents(
    text,
    providerConfig,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    enableAIContentAware,
    { title: articleTitle, textContent: articleTextContent },
  )

  // Add extra hash tags for cache differentiation
  hashComponents.push(...extraHashTags)

  return await sendMessage("enqueueTranslateRequest", {
    text,
    langConfig,
    providerConfig,
    scheduleAt: Date.now(),
    hash: Sha256Hex(...hashComponents),
    articleTitle,
    articleTextContent,
  })
}

export function validateTranslationConfigAndToast(
  config: Pick<Config, "providersConfig" | "translate" | "language">,
  detectedCode: LangCodeISO6393,
): boolean {
  const { providersConfig, translate: translateConfig, language: languageConfig } = config
  const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
  if (!providerConfig) {
    return false
  }

  if (languageConfig.sourceCode === languageConfig.targetCode) {
    toast.error(i18n.t("translation.sameLanguage"))
    logger.info("validateTranslationConfig: returning false (same language)")
    return false
  }
  else if (languageConfig.sourceCode === "auto" && detectedCode === languageConfig.targetCode) {
    toast.warning(i18n.t("translation.autoModeSameLanguage", [
      LANG_CODE_TO_LOCALE_NAME[detectedCode] ?? detectedCode,
    ]))
  }

  // check if the API key is configured
  if (isAPIProviderConfig(providerConfig) && !providerConfig.apiKey?.trim() && !["deeplx", "ollama"].includes(providerConfig.provider)) {
    toast.error(i18n.t("noAPIKeyConfig.warning"))
    logger.info("validateTranslationConfig: returning false (no API key)")
    return false
  }

  return true
}
