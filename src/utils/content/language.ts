import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { LLMTranslateProviderConfig } from '@/types/config/provider'
import { LANG_CODE_TO_EN_NAME, langCodeISO6393Schema } from '@read-frog/definitions'
import { generateText } from 'ai'
import { franc } from 'franc'
import z from 'zod'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderConfigById } from '@/utils/config/helpers'
import { getLocalConfig } from '@/utils/config/storage'
import { logger } from '@/utils/logger'
import { getTranslateModelById } from '@/utils/providers/model'
import { getProviderOptionsWithOverride } from '@/utils/providers/options'
import { cleanText } from './utils'

const DEFAULT_MIN_LENGTH = 10
const DEFAULT_MAX_LENGTH_FOR_LLM = 500

export type DetectionSource = 'llm' | 'franc' | 'fallback'

export interface DetectLanguageOptions {
  /** Minimum text length to attempt detection (default: 10) */
  minLength?: number
  /** Enable LLM detection */
  enableLLM?: boolean
  /** LLM provider config for detection (non-LLM providers not supported) */
  providerConfig?: LLMTranslateProviderConfig
  /** Max text length for LLM detection (default: 500) */
  maxLengthForLLM?: number
}

export interface DetectLanguageResult {
  code: LangCodeISO6393 | 'und'
  source: DetectionSource
}

/**
 * Detect language of text using franc, with optional LLM enhancement.
 * Returns both the detected code and the detection source.
 * @param text - Text to detect language for
 * @param options - Detection options
 * @returns Detection result with code and source
 */
export async function detectLanguageWithSource(
  text: string,
  options?: DetectLanguageOptions,
): Promise<DetectLanguageResult> {
  const trimmedText = text.trim()
  const minLength = options?.minLength ?? DEFAULT_MIN_LENGTH

  if (trimmedText.length < minLength) {
    return { code: 'und', source: 'fallback' }
  }

  // Try LLM detection first if enabled
  if (options?.enableLLM) {
    try {
      const maxLength = options.maxLengthForLLM ?? DEFAULT_MAX_LENGTH_FOR_LLM
      const textForLLM = cleanText(trimmedText, maxLength)
      const llmResult = await detectLanguageWithLLM(
        textForLLM,
        options?.providerConfig,
      )
      if (llmResult && llmResult !== 'und') {
        return { code: llmResult, source: 'llm' }
      }
    }
    catch (error) {
      logger.warn('LLM detection failed, falling back to franc:', error)
    }
  }

  // Fallback to franc
  const francResult = franc(trimmedText)
  if (francResult === 'und') {
    return { code: 'und', source: 'fallback' }
  }
  return { code: francResult as LangCodeISO6393, source: 'franc' }
}

/**
 * Detect language of text using franc, with optional LLM enhancement.
 * @param text - Text to detect language for
 * @param options - Detection options
 * @returns Detected language code or null if detection failed
 */
export async function detectLanguage(
  text: string,
  options?: DetectLanguageOptions,
): Promise<LangCodeISO6393 | null> {
  const result = await detectLanguageWithSource(text, options)
  return result.code === 'und' ? null : result.code
}

/**
 * Detect language using LLM with retry logic
 * @param text - Text to analyze (caller is responsible for combining title and content)
 * @param providerConfig - Optional provider config (if not provided, will get from global config)
 * @returns ISO 639-3 language code or null if all attempts fail (null = no LLM provider or all attempts failed)
 */
export async function detectLanguageWithLLM(
  text: string,
  providerConfig?: LLMTranslateProviderConfig,
): Promise<LangCodeISO6393 | 'und' | null> {
  const MAX_ATTEMPTS = 3 // 1 original + 2 retries

  if (!text.trim()) {
    logger.warn('No text provided for language detection')
    return null
  }

  // Get provider config - use passed or fall back to global
  let config: LLMTranslateProviderConfig | undefined = providerConfig

  if (!config) {
    try {
      const globalConfig = await getLocalConfig()
      if (!globalConfig) {
        logger.warn('No config found for language detection')
        return null
      }
      const globalProvider = getProviderConfigById(
        globalConfig.providersConfig,
        globalConfig.translate.providerId,
      )
      if (!globalProvider || !isLLMTranslateProviderConfig(globalProvider)) {
        logger.info('No LLM translate provider configured')
        return null
      }
      config = globalProvider
    }
    catch (error) {
      logger.error('Failed to get global config for language detection:', error)
      return null
    }
  }

  try {
    const { models: { translate }, provider, providerOptions: userProviderOptions, temperature } = config
    const translateModel = translate.isCustomModel ? translate.customModel : translate.model
    const providerOptions = getProviderOptionsWithOverride(translateModel ?? '', provider, userProviderOptions)
    const model = await getTranslateModelById(config.id)

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
          temperature,
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
