import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { BackgroundGenerateTextPayload } from '@/types/background-generate-text'
import type { LLMProviderConfig } from '@/types/config/provider'
import { franc } from 'franc'
import { isLLMProviderConfig } from '@/types/config/provider'
import { getProviderConfigById } from '@/utils/config/helpers'
import { getLocalConfig } from '@/utils/config/storage'
import { logger } from '@/utils/logger'
import { sendMessage } from '@/utils/message'
import { getLanguageDetectionSystemPrompt, parseDetectedLanguageCode } from '@/utils/prompts/language-detection'
import { resolveModelId } from '@/utils/providers/model'
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
  providerConfig?: LLMProviderConfig
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
  providerConfig?: LLMProviderConfig,
): Promise<LangCodeISO6393 | 'und' | null> {
  const MAX_ATTEMPTS = 3 // 1 original + 2 retries

  if (!text.trim()) {
    logger.warn('No text provided for language detection')
    return null
  }

  // Get provider config - use passed or fall back to global
  let config: LLMProviderConfig | undefined = providerConfig

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
      if (!globalProvider || !isLLMProviderConfig(globalProvider)) {
        logger.info('No LLM provider configured for page translation')
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
    const { model: providerModel, provider, providerOptions: userProviderOptions, temperature } = config
    const modelName = resolveModelId(providerModel)
    const providerOptions = getProviderOptionsWithOverride(modelName ?? '', provider, userProviderOptions)
    const payload: BackgroundGenerateTextPayload = {
      providerId: config.id,
      system: getLanguageDetectionSystemPrompt(),
      prompt: text,
      temperature,
      providerOptions,
      maxRetries: 0,
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await sendMessage('backgroundGenerateText', payload)
        const detectedCode = parseDetectedLanguageCode(response.text)

        if (detectedCode) {
          logger.info(`LLM language detection succeeded on attempt ${attempt}: ${detectedCode}`)
          return detectedCode
        }
        else {
          logger.warn(`LLM returned invalid language code on attempt ${attempt}: "${response.text}"`)
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
