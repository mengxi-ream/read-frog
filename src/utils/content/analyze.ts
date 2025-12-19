import type { LangCodeISO6393 } from '@read-frog/definitions'
import { Readability } from '@mozilla/readability'
import { LANG_CODE_TO_EN_NAME, langCodeISO6393Schema } from '@read-frog/definitions'
import { generateText } from 'ai'
import { franc } from 'franc-min'
import z from 'zod'
import { flattenToParagraphs } from '@/entrypoints/side.content/utils/article'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderConfigById } from '../config/helpers'
import { getLocalConfig } from '../config/storage'
import { getProviderOptions } from '../constants/model'
import { logger } from '../logger'
import { getTranslateModelById } from '../providers/model'
import { cleanText, removeDummyNodes } from './utils'

export type DetectionSource = 'llm' | 'franc' | 'fallback'

export async function getDocumentInfo(): Promise<{
  article: ReturnType<Readability<Node>['parse']>
  paragraphs: string[]
  detectedCodeOrUnd: LangCodeISO6393 | 'und'
  detectionSource: DetectionSource
}> {
  const documentClone = document.cloneNode(true)
  await removeDummyNodes(documentClone as Document)
  const article = new Readability(documentClone as Document, {
    serializer: el => el,
  }).parse()
  const paragraphs = article?.content
    ? flattenToParagraphs(article.content)
    : []

  logger.info('article', article)

  let detectedCodeOrUnd: LangCodeISO6393 | 'und' = 'und'
  let detectionSource: DetectionSource = 'fallback'

  // Get config to check if LLM detection is enabled
  const config = await getLocalConfig()

  // Try LLM detection first if enabled and auto-translate languages are configured
  if (config?.translate.page.enableLLMDetection && config?.translate.page.autoTranslateLanguages?.length > 0) {
    try {
      // Combine and truncate text for LLM detection
      const title = article?.title || ''
      const content = article?.textContent || ''
      const textForLLM = cleanText(`${title}\n\n${content}`, 1500)

      if (textForLLM) {
        const llmResult = await detectLanguageWithLLM(textForLLM)

        if (llmResult) {
          detectedCodeOrUnd = llmResult
          detectionSource = 'llm'
          logger.info(`Language detected by LLM: ${llmResult}`)
        }
      }
    }
    catch (error) {
      logger.error('LLM language detection failed, will fallback to franc:', error)
    }
  }

  // Fallback to franc only if LLM didn't succeed
  if (detectionSource !== 'llm') {
    const francInput = cleanText(`${article?.title || ''} ${article?.textContent || ''}`, Infinity)
    if (francInput) {
      const francResult = franc(francInput)
      logger.info('franc result', francResult)

      detectedCodeOrUnd = francResult === 'und'
        ? 'und'
        : (francResult as LangCodeISO6393)
      detectionSource = francResult === 'und' ? 'fallback' : 'franc'
      logger.info(`Language detected by franc: ${francResult}`)
    }
  }

  logger.info('final detectionSource', detectionSource)
  logger.info('final detectedCodeOrUnd', detectedCodeOrUnd)

  return {
    article,
    paragraphs,
    detectedCodeOrUnd,
    detectionSource,
  }
}

/**
 * Detect language using LLM with retry logic
 * @param text - Text to analyze (caller is responsible for combining title and content)
 * @returns ISO 639-3 language code or null if all attempts fail (null = no LLM provider or all attempts failed)
 */
export async function detectLanguageWithLLM(
  text: string,
): Promise<LangCodeISO6393 | 'und' | null> {
  const MAX_ATTEMPTS = 3 // 1 original + 2 retries

  if (!text.trim()) {
    logger.warn('No text provided for language detection')
    return null
  }

  // Get model from config
  try {
    const config = await getLocalConfig()
    if (!config) {
      logger.warn('No config found for language detection')
      return null
    }

    const providerConfig = getProviderConfigById(
      config.providersConfig,
      config.translate.providerId,
    )

    if (!providerConfig || !isLLMTranslateProviderConfig(providerConfig)) {
      logger.info('No LLM translate provider configured')
      return null
    }

    const { models: { translate }, name: providerName } = providerConfig
    const translateModel = translate.isCustomModel ? translate.customModel : translate.model
    const providerOptions = getProviderOptions(translateModel ?? '', providerName)
    const model = await getTranslateModelById(providerConfig.id)

    // Create language list for prompt
    const languageList = Object.entries(LANG_CODE_TO_EN_NAME)
      .map(([code, name]) => `- ${code}: ${name}`)
      .join('\n')

    const system = `You are a language detection assistant. Your task is to identify the language of text and return ONLY the ISO 639-3 language code.

Rules:
- Return ONLY the language code (e.g., "eng" or "cmn" or "und")
- Do NOT include explanations, punctuation, or any other text
- Return "und" if the language is not in the supported list

Supported ISO 639-3 language codes:
${languageList}`

    const prompt = text

    // TODO: move this API call to background script to deal with CORS issue from some providers

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { text: responseText } = await generateText({
          model,
          system,
          prompt,
          providerOptions,
        })

        // Clean the response (trim whitespace, quotes, newlines)
        const cleanedCode = responseText.trim().toLowerCase().replace(/['"`,.\s]/g, '')

        // Validate with Zod schema
        const parseResult = langCodeISO6393Schema.or(z.literal('und')).safeParse(cleanedCode)

        if (parseResult.success) {
          logger.info(`LLM language detection succeeded on attempt ${attempt}: ${parseResult.data}`)
          return parseResult.data
        }
        else {
          logger.warn(`LLM returned invalid language code on attempt ${attempt}: "${responseText}" (cleaned: "${cleanedCode}")`)
          // Don't throw, just continue to next attempt
        }
      }
      catch (error) {
        logger.error(`LLM language detection attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error)
      }

      if (attempt === MAX_ATTEMPTS) {
        logger.warn('All LLM language detection attempts failed')
        return null
      }
    }
  }
  catch (error) {
    logger.error('Failed to get model for language detection:', error)
    return null
  }

  return null
}
