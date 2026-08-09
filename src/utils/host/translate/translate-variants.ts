import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config, InputTranslationLang } from "@/types/config/config"
import type { TranslationTextFormat } from "@/types/config/translate"
import { isLLMProviderConfig } from "@/types/config/provider"
import { getDetectedCodeFromStorage, getFinalSourceCode } from "@/utils/config/languages"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { logger } from "@/utils/logger"
import {
  isSystemTranslationProvider,
  resolvePageTranslationProvider,
  type PageTranslationProvider,
} from "@/utils/providers/translation-provider"
import { getLocalConfig } from "../../config/storage"
import { shouldSkipAsTargetLanguage } from "./target-language-skip"
import { prepareTranslationText } from "./text-preparation"
import {
  MIN_LENGTH_FOR_SKIP_LLM_DETECTION,
  shouldSkipByLanguage,
  translateTextCore,
} from "./translate-text"
import { getPageTranslationSessionId } from "./translation-session"
import { getOrCreateWebPageContext } from "./webpage-context"
import { getOrGenerateWebPageSummary } from "./webpage-summary"

async function getConfigOrThrow(): Promise<Config> {
  const config = await getLocalConfig()
  if (!config) {
    throw new Error("No global config when translate text")
  }
  return config
}

async function getWebPagePromptContext(
  providerConfig: PageTranslationProvider,
  enableAIContentAware: boolean,
  includeSummary: boolean,
): Promise<
  { webTitle: string; webDescription?: string; webContent: string; webSummary?: string } | undefined
> {
  if (isSystemTranslationProvider(providerConfig) || !isLLMProviderConfig(providerConfig)) {
    return undefined
  }

  const webPageContext = await getOrCreateWebPageContext()
  if (!webPageContext) {
    return undefined
  }

  const webSummary = includeSummary
    ? await getOrGenerateWebPageSummary(webPageContext, providerConfig, enableAIContentAware)
    : undefined

  return {
    webTitle: webPageContext.webTitle,
    webDescription: webPageContext.webDescription,
    webContent: webPageContext.webContent,
    webSummary: webSummary ?? undefined,
  }
}

async function translateTextUsingPageConfig(
  config: Config,
  text: string,
  options: {
    extraHashTags?: string[]
    webPageContext?: {
      webTitle?: string | null
      webDescription?: string | null
      webContent?: string | null
      webSummary?: string | null
    }
    textFormat?: TranslationTextFormat
    preserveLineBreaks?: boolean
    // Session captured at pipeline entry by the caller; see translateTextForPage.
    sessionId?: string
    forceRetranslation?: boolean
  } = {},
): Promise<string> {
  const preparedText = prepareTranslationText(text)
  if (preparedText === "") {
    return ""
  }

  const providerConfig = resolvePageTranslationProvider(config)

  // Backstop only: the page modes hoist this check before DOM insertion, but
  // other callers (e.g. the page title) still rely on it here.
  if (await shouldSkipAsTargetLanguage(preparedText, config)) {
    logger.info(
      `translateTextForPage: skipping translation because text is already in target language. text: ${preparedText}`,
    )
    return ""
  }

  // Skip translation if text is in skipLanguages list (page translation only)
  const { skipLanguages } = config.pageTranslation.page
  if (skipLanguages.length > 0 && preparedText.length >= MIN_LENGTH_FOR_SKIP_LLM_DETECTION) {
    const shouldSkip = await shouldSkipByLanguage(
      preparedText,
      skipLanguages,
      config.languageDetection.mode === "llm",
    )
    if (shouldSkip) {
      logger.info(
        `translateTextForPage: skipping translation because text is in skip language list. text: ${preparedText}`,
      )
      return ""
    }
  }

  return translateTextCore({
    text: preparedText,
    langConfig: config.language,
    providerConfig,
    enableAIContentAware: config.pageTranslation.enableAIContentAware,
    extraHashTags: options.extraHashTags,
    webPageContext: options.webPageContext,
    textFormat: options.textFormat,
    preserveLineBreaks: options.preserveLineBreaks,
    sessionId: options.sessionId,
    forceRetranslation: options.forceRetranslation,
  })
}

export interface PageTranslationRequestOptions {
  preserveLineBreaks?: boolean
  forceRetranslation?: boolean
}

/**
 * Page translation — uses FEATURE_PROVIDER_DEFS['translate'].
 * Includes skip-language logic (page translation only).
 */
export async function translateTextForPage(
  text: string,
  textFormat: TranslationTextFormat = "plain",
  options?: PageTranslationRequestOptions,
): Promise<string> {
  // Capture the session id synchronously at pipeline entry. Reading it later
  // (after the awaits below, e.g. the network-backed page summary) could see
  // null if the user cancelled mid-request — the request would then be sent
  // unscoped and stay permanently uncancellable, re-creating #1881.
  const sessionId = getPageTranslationSessionId() ?? undefined
  const config = await getConfigOrThrow()
  const providerConfig = resolvePageTranslationProvider(config)
  const webPageContext = await getWebPagePromptContext(
    providerConfig,
    config.pageTranslation.enableAIContentAware,
    true,
  )

  return translateTextUsingPageConfig(config, text, {
    webPageContext,
    textFormat,
    preserveLineBreaks: options?.preserveLineBreaks,
    sessionId,
    forceRetranslation: options?.forceRetranslation,
  })
}

/**
 * Page title translation — uses page translation settings, but always treats the
 * current source title as the webpage title context.
 */
export async function translateTextForPageTitle(text: string): Promise<string> {
  const sessionId = getPageTranslationSessionId() ?? undefined
  const config = await getConfigOrThrow()
  const providerConfig = resolvePageTranslationProvider(config)
  const webPageContext = config.pageTranslation.enableAIContentAware
    ? await getWebPagePromptContext(providerConfig, true, false)
    : undefined

  return translateTextUsingPageConfig(config, text, {
    extraHashTags: ["pageTitleTranslation"],
    webPageContext: {
      webTitle: text,
      webDescription: webPageContext?.webDescription,
      webContent: webPageContext?.webContent,
      webSummary: webPageContext?.webSummary,
    },
    sessionId,
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

  const webPageContext = await getWebPagePromptContext(
    providerConfig,
    config.pageTranslation.enableAIContentAware,
    true,
  )

  return translateTextCore({
    text,
    langConfig: {
      sourceCode: resolvedFromLang,
      targetCode: resolvedToLang,
      level: config.language.level,
    },
    extraHashTags: [`inputTranslation:${fromLang}->${toLang}`],
    providerConfig,
    enableAIContentAware: config.pageTranslation.enableAIContentAware,
    webPageContext,
    // User-typed newlines are always meaningful.
    preserveLineBreaks: true,
  })
}
