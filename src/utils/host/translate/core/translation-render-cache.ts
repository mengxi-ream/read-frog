import type { Config } from "@/types/config/config"
import { isLLMProviderConfig } from "@/types/config/provider"
import { getProviderConfigById } from "@/utils/config/helpers"
import { prepareTranslationText } from "../text-preparation"

export const MAX_BILINGUAL_RENDER_CACHE_SIZE = 400

const bilingualRenderCache = new Map<string, string>()

/**
 * Builds a cache key that uniquely identifies a rendered bilingual translation.
 *
 * `pageContextId` (the page URL) is folded into the key only for LLM providers,
 * because LLM providers inject the current page's title/summary/content into the
 * translation prompt (see DEFAULT_TRANSLATE_SYSTEM_PROMPT and getWebPagePromptContext).
 * That means the same source text can translate differently depending on which page
 * produced it, so cache entries must not be shared across pages. Non-LLM providers
 * (Google/DeepL/Microsoft/etc.) ignore page context, so their entries stay shareable.
 */
export function buildBilingualRenderCacheKey(sourceText: string, config: Config, pageContextId?: string): string {
  const providerConfig = getProviderConfigById(config.providersConfig, config.translate.providerId)
  const detectorProviderConfig = config.languageDetection.mode === "llm" && config.languageDetection.providerId
    ? getProviderConfigById(config.providersConfig, config.languageDetection.providerId)
    : null
  const pageContext = providerConfig && isLLMProviderConfig(providerConfig)
    ? (pageContextId ?? null)
    : null

  return JSON.stringify({
    text: prepareTranslationText(sourceText),
    language: {
      sourceCode: config.language.sourceCode,
      targetCode: config.language.targetCode,
      level: config.language.level,
    },
    translate: {
      providerId: config.translate.providerId,
      enableAIContentAware: config.translate.enableAIContentAware,
      customPromptsConfig: config.translate.customPromptsConfig,
      translationNodeStyle: config.translate.translationNodeStyle,
      mode: config.translate.mode,
      pageSkip: {
        enableTargetLanguageSkip: config.translate.page.enableTargetLanguageSkip,
        skipLanguages: config.translate.page.skipLanguages,
      },
    },
    languageDetection: {
      mode: config.languageDetection.mode,
      providerId: config.languageDetection.providerId ?? null,
      providerConfig: detectorProviderConfig ?? null,
    },
    providerConfig: providerConfig ?? null,
    pageContext,
  })
}

export function getCachedBilingualTranslation(cacheKey: string): string | undefined {
  return bilingualRenderCache.get(cacheKey)
}

export function setCachedBilingualTranslation(cacheKey: string, translatedText: string): void {
  if (bilingualRenderCache.has(cacheKey)) {
    bilingualRenderCache.delete(cacheKey)
  }
  else if (bilingualRenderCache.size >= MAX_BILINGUAL_RENDER_CACHE_SIZE) {
    const oldestKey = bilingualRenderCache.keys().next().value
    if (oldestKey !== undefined) {
      bilingualRenderCache.delete(oldestKey)
    }
  }

  bilingualRenderCache.set(cacheKey, translatedText)
}

export function clearBilingualRenderCache(): void {
  bilingualRenderCache.clear()
}
