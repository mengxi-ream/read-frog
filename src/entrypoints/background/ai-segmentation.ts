import { generateText } from 'ai'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderConfigById } from '@/utils/config/helpers'
import { db } from '@/utils/db/dexie/db'
import { Sha256Hex } from '@/utils/hash'
import { logger } from '@/utils/logger'
import { getSubtitlesSegmentationPrompt } from '@/utils/prompts/subtitles-segmentation'
import { getTranslateModelById } from '@/utils/providers/model'
import { getProviderOptionsWithOverride } from '@/utils/providers/options'
import { ensureInitializedConfig } from './config'

interface AiSegmentSubtitlesData {
  jsonContent: string
  providerId: string
}

/**
 * Clean VTT response from AI (remove markdown code blocks, ensure WEBVTT header)
 */
function cleanVttResponse(text: string): string {
  let cleaned = text.trim()

  // Remove markdown code blocks
  cleaned = cleaned.replace(/```vtt\n?/g, '').replace(/```\n?/g, '')

  // Handle thinking model output (strip <think> tags)
  const [, afterThink = cleaned] = cleaned.match(/<\/think>([\s\S]*)/) || []
  cleaned = afterThink.trim()

  // Ensure starts with WEBVTT
  if (!cleaned.toUpperCase().startsWith('WEBVTT')) {
    cleaned = `WEBVTT\n\n${cleaned}`
  }

  return cleaned
}

/**
 * Run AI segmentation on JSON subtitle content
 */
export async function runAiSegmentSubtitles(data: AiSegmentSubtitlesData): Promise<string> {
  const { jsonContent, providerId } = data

  if (!jsonContent) {
    throw new Error('jsonContent is required for AI segmentation')
  }

  const config = await ensureInitializedConfig()
  if (!config) {
    throw new Error('Config not found')
  }

  const providerConfig = getProviderConfigById(config.providersConfig, providerId)
  if (!providerConfig) {
    throw new Error(`Provider config not found for id: ${providerId}`)
  }

  if (!isLLMTranslateProviderConfig(providerConfig)) {
    throw new Error('AI segmentation requires an LLM translate provider')
  }

  // Check cache
  const jsonContentHash = Sha256Hex(jsonContent)
  const cacheKey = Sha256Hex(jsonContentHash, JSON.stringify(providerConfig))
  const cached = await db.aiSegmentationCache.get(cacheKey)
  if (cached) {
    logger.info('[Background] AI subtitle segmentation cache hit')
    return cached.result
  }

  const { models: { translate }, provider, providerOptions: userProviderOptions, temperature } = providerConfig
  const translateModel = translate.isCustomModel ? translate.customModel : translate.model
  const providerOptions = getProviderOptionsWithOverride(translateModel ?? '', provider, userProviderOptions)
  const model = await getTranslateModelById(providerId)

  const { systemPrompt, prompt } = getSubtitlesSegmentationPrompt(jsonContent)

  try {
    const { text: segmentedVtt } = await generateText({
      model,
      system: systemPrompt,
      prompt,
      temperature,
      providerOptions,
      maxRetries: 0,
    })

    const result = cleanVttResponse(segmentedVtt)

    // Write to cache
    await db.aiSegmentationCache.put({
      key: cacheKey,
      result,
      createdAt: new Date(),
    })

    logger.info('[Background] AI subtitle segmentation completed')
    return result
  }
  catch (error) {
    logger.error('[Background] AI subtitle segmentation failed:', error)
    throw error
  }
}
