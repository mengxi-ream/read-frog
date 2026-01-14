import type { LangCodeISO6393, LangLevel } from '@read-frog/definitions'
import type { Config, InputTranslationLang } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { Readability } from '@mozilla/readability'
import { LANG_CODE_TO_EN_NAME, LANG_CODE_TO_LOCALE_NAME } from '@read-frog/definitions'
import { franc } from 'franc'
import { toast } from 'sonner'
import { isAPIProviderConfig, isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderConfigById } from '@/utils/config/helpers'
import { getDetectedCodeFromStorage, getFinalSourceCode } from '@/utils/config/languages'
import { removeDummyNodes } from '@/utils/content/utils'
import { logger } from '@/utils/logger'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getLocalConfig } from '../../config/storage'
import { Sha256Hex } from '../../hash'
import { sendMessage } from '../../message'

const MIN_LENGTH_FOR_LANG_DETECTION = 50

// Module-level cache for article data (only meaningful in content script context)
let cachedArticleData: {
  url: string
  title: string
  textContent: string
} | null = null

function getCachedArticleData(): typeof cachedArticleData {
  // Clear cache if URL has changed
  if (typeof window !== 'undefined' && cachedArticleData?.url !== window.location.href) {
    cachedArticleData = null
  }
  return cachedArticleData
}

export async function getOrFetchArticleData(
  enableAIContentAware: boolean,
): Promise<{ title: string, textContent?: string } | null> {
  // Only works in browser context
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }

  // When our extension add content to the page, we don't want the cache to be invalidated
  // so our cache here will always live unless the page is refreshed
  const cached = getCachedArticleData()

  // Cache should only be reused when the stored entry already includes text content
  // otherwise the feature never obtains article text after being enabled mid-session.
  if (cached && (!enableAIContentAware || cached.textContent)) {
    return {
      title: cached.title,
      textContent: enableAIContentAware ? cached.textContent : undefined,
    }
  }

  // Always get title
  const title = document.title || ''

  // Only extract textContent if needed
  let textContent = ''
  if (enableAIContentAware) {
    // Try Readability first for cleaner content
    try {
      const documentClone = document.cloneNode(true) as Document
      await removeDummyNodes(documentClone)
      const article = new Readability(documentClone, { serializer: el => el }).parse()

      if (article?.textContent) {
        textContent = article.textContent
      }
    }
    catch (error) {
      logger.warn('Readability parsing failed, falling back to body textContent:', error)
    }

    // Fallback to document.body if Readability failed
    if (!textContent) {
      textContent = document.body?.textContent || ''
    }
  }

  cachedArticleData = {
    url: window.location.href,
    title,
    textContent,
  }

  return {
    title,
    textContent: enableAIContentAware ? textContent : undefined,
  }
}

export async function buildHashComponents(
  text: string,
  providerConfig: ProviderConfig,
  partialLangConfig: { sourceCode: LangCodeISO6393 | 'auto', targetCode: LangCodeISO6393 },
  enableAIContentAware: boolean,
  articleContext?: { title?: string, textContent?: string },
): Promise<string[]> {
  const hashComponents = [
    text,
    JSON.stringify(providerConfig),
    // don't include detectedCode because it may change after the page is translated, i.e. it's not accurate
    partialLangConfig.sourceCode,
    partialLangConfig.targetCode,
  ]

  if (isLLMTranslateProviderConfig(providerConfig)) {
    const targetLangName = LANG_CODE_TO_EN_NAME[partialLangConfig.targetCode]
    const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, text, { isBatch: true })
    hashComponents.push(systemPrompt, prompt)
    hashComponents.push(enableAIContentAware ? 'enableAIContentAware=true' : 'enableAIContentAware=false')

    // Include article context in hash when AI Content Aware is enabled
    // to ensure when we get different content from the same url, we get different cache entries
    if (enableAIContentAware && articleContext) {
      if (articleContext.title) {
        hashComponents.push(`title:${articleContext.title}`)
      }
      if (articleContext.textContent) {
        // Use a substring hash to avoid huge hash inputs while still differentiating articles
        hashComponents.push(`content:${articleContext.textContent.slice(0, 1000)}`)
      }
    }
  }

  return hashComponents
}

interface TranslateTextOptions {
  text: string
  langConfig: { sourceCode: LangCodeISO6393 | 'auto', targetCode: LangCodeISO6393, level: LangLevel }
  extraHashTags?: string[]
}

/**
 * Core translation function that handles common logic
 */
async function translateTextCore(options: TranslateTextOptions): Promise<string> {
  const { text, langConfig, extraHashTags = [] } = options

  const config = await getLocalConfig()
  if (!config) {
    throw new Error('No global config when translate text')
  }

  const providerId = config.translate.providerId
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)

  if (!providerConfig) {
    throw new Error(`No provider config for id ${providerId} when translate text`)
  }

  // Skip translation if text is already in target language
  if (text.length >= MIN_LENGTH_FOR_LANG_DETECTION) {
    const detectedLang = franc(text)
    if (detectedLang === langConfig.targetCode) {
      logger.info(`translateTextCore: skipping translation because text is already in target language. text: ${text}`)
      return ''
    }
  }

  // Get article data for LLM providers (needed for both hash and request)
  let articleTitle: string | undefined
  let articleTextContent: string | undefined

  if (isLLMTranslateProviderConfig(providerConfig)) {
    const articleData = await getOrFetchArticleData(config.translate.enableAIContentAware)
    if (articleData) {
      articleTitle = articleData.title
      articleTextContent = articleData.textContent
    }
  }

  const hashComponents = await buildHashComponents(
    text,
    providerConfig,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    config.translate.enableAIContentAware,
    { title: articleTitle, textContent: articleTextContent },
  )

  // Add extra hash tags for cache differentiation
  hashComponents.push(...extraHashTags)

  return await sendMessage('enqueueTranslateRequest', {
    text,
    langConfig,
    providerConfig,
    scheduleAt: Date.now(),
    hash: Sha256Hex(...hashComponents),
    articleTitle,
    articleTextContent,
  })
}

export async function translateText(text: string): Promise<string> {
  const config = await getLocalConfig()
  if (!config) {
    throw new Error('No global config when translate text')
  }

  return translateTextCore({
    text,
    langConfig: config.language,
  })
}

async function resolveInputLang(
  lang: InputTranslationLang,
  globalLangConfig: Config['language'],
): Promise<LangCodeISO6393> {
  if (lang === 'sourceCode') {
    const detectedCode = await getDetectedCodeFromStorage()
    return getFinalSourceCode(globalLangConfig.sourceCode, detectedCode)
  }
  if (lang === 'targetCode') {
    return globalLangConfig.targetCode
  }
  return lang
}

export async function translateTextForInput(
  text: string,
  fromLang: InputTranslationLang,
  toLang: InputTranslationLang,
): Promise<string> {
  const config = await getLocalConfig()
  if (!config) {
    throw new Error('No global config when translate text')
  }

  const resolvedFromLang = await resolveInputLang(fromLang, config.language)
  const resolvedToLang = await resolveInputLang(toLang, config.language)

  if (resolvedFromLang === resolvedToLang) {
    return ''
  }

  return translateTextCore({
    text,
    langConfig: {
      sourceCode: resolvedFromLang,
      targetCode: resolvedToLang,
      level: config.language.level,
    },
    extraHashTags: [`inputTranslation:${fromLang}->${toLang}`],
  })
}

export function validateTranslationConfigAndToast(
  config: Pick<Config, 'providersConfig' | 'translate' | 'language'>,
  detectedCode: LangCodeISO6393,
): boolean {
  const { providersConfig, translate: translateConfig, language: languageConfig } = config
  const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
  if (!providerConfig) {
    return false
  }

  if (languageConfig.sourceCode === languageConfig.targetCode) {
    toast.error(i18n.t('translation.sameLanguage'))
    logger.info('validateTranslationConfig: returning false (same language)')
    return false
  }
  else if (languageConfig.sourceCode === 'auto' && detectedCode === languageConfig.targetCode) {
    toast.warning(i18n.t('translation.autoModeSameLanguage', [
      LANG_CODE_TO_LOCALE_NAME[detectedCode] ?? detectedCode,
    ]))
  }

  // check if the API key is configured
  if (isAPIProviderConfig(providerConfig) && !providerConfig.apiKey?.trim() && !['deeplx', 'ollama'].includes(providerConfig.provider)) {
    toast.error(i18n.t('noAPIKeyConfig.warning'))
    logger.info('validateTranslationConfig: returning false (no API key)')
    return false
  }

  return true
}
