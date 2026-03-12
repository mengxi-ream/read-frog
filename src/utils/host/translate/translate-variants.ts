import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config, InputTranslationLang } from "@/types/config/config"
import { getDetectedCodeFromStorage, getFinalSourceCode } from "@/utils/config/languages"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { logger } from "@/utils/logger"
import { getLocalConfig } from "../../config/storage"
import { getOrFetchArticleData } from "./article-context"
import { MIN_LENGTH_FOR_SKIP_LLM_DETECTION, shouldSkipByLanguage, translateTextCore } from "./translate-text"

async function getConfigOrThrow(): Promise<Config> {
  const config = await getLocalConfig()
  if (!config) {
    throw new Error("No global config when translate text")
  }
  return config
}

async function translateTextUsingPageConfig(
  config: Config,
  text: string,
  options: {
    extraHashTags?: string[]
    articleContext?: { title?: string | null, textContent?: string | null }
  } = {},
): Promise<string> {
  const providerConfig = resolveProviderConfig(config, "translate")

  // Skip translation if text is in skipLanguages list (page translation only)
  const { skipLanguages, enableSkipLanguagesLLMDetection } = config.translate.page
  if (skipLanguages.length > 0 && text.length >= MIN_LENGTH_FOR_SKIP_LLM_DETECTION) {
    const shouldSkip = await shouldSkipByLanguage(
      text,
      skipLanguages,
      enableSkipLanguagesLLMDetection,
      providerConfig,
    )
    if (shouldSkip) {
      logger.info(`translateTextForPage: skipping translation because text is in skip language list. text: ${text}`)
      return ""
    }
  }

  return translateTextCore({
    text,
    langConfig: config.language,
    providerConfig,
    enableAIContentAware: config.translate.enableAIContentAware,
    extraHashTags: options.extraHashTags,
    articleContext: options.articleContext,
  })
}

/**
 * Page translation — uses FEATURE_PROVIDER_DEFS['translate'].
 * Includes skip-language logic (page translation only).
 */
export async function translateTextForPage(text: string): Promise<string> {
  const config = await getConfigOrThrow()
  const articleData = await getOrFetchArticleData(config.translate.enableAIContentAware)
  return translateTextUsingPageConfig(config, text, {
    articleContext: articleData ?? undefined,
  })
}

/**
 * Page title translation — uses page translation settings, but always treats the
 * current source title as the article title context.
 */
export async function translateTextForPageTitle(text: string): Promise<string> {
  const config = await getConfigOrThrow()
  const articleContext = await getOrFetchArticleData(config.translate.enableAIContentAware)

  return translateTextUsingPageConfig(config, text, {
    extraHashTags: ["pageTitleTranslation"],
    articleContext: {
      title: text,
      textContent: articleContext?.textContent,
    },
  })
}

async function resolveInputLang(
  lang: InputTranslationLang,
  globalLangConfig: Config["language"],
): Promise<LangCodeISO6393> {
  if (lang === "sourceCode") {
    const detectedCode = await getDetectedCodeFromStorage()
    return getFinalSourceCode(globalLangConfig.sourceCode, detectedCode)
  }
  if (lang === "targetCode") {
    return globalLangConfig.targetCode
  }
  return lang
}

/**
 * Input translation — uses FEATURE_PROVIDER_DEFS['inputTranslation'].
 */
export async function translateTextForInput(
  text: string,
  fromLang: InputTranslationLang,
  toLang: InputTranslationLang,
): Promise<string> {
  const config = await getConfigOrThrow()
  const providerConfig = resolveProviderConfig(config, "inputTranslation")

  const resolvedFromLang = await resolveInputLang(fromLang, config.language)
  const resolvedToLang = await resolveInputLang(toLang, config.language)

  if (resolvedFromLang === resolvedToLang) {
    return ""
  }

  const articleData = await getOrFetchArticleData(config.translate.enableAIContentAware)

  return translateTextCore({
    text,
    langConfig: {
      sourceCode: resolvedFromLang,
      targetCode: resolvedToLang,
      level: config.language.level,
    },
    extraHashTags: [`inputTranslation:${fromLang}->${toLang}`],
    providerConfig,
    enableAIContentAware: config.translate.enableAIContentAware,
    articleContext: articleData ?? undefined,
  })
}
