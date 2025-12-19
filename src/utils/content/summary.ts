import type { LLMTranslateProviderConfig } from '@/types/config/provider'
import { generateText } from 'ai'
import { getProviderOptions } from '@/utils/constants/model'
import { logger } from '@/utils/logger'
import { getTranslateModelById } from '@/utils/providers/model'
import { cleanText } from './utils'

/**
 * Generate a brief summary of article content for translation context
 */
export async function generateArticleSummary(
  title: string,
  textContent: string,
  providerConfig: LLMTranslateProviderConfig,
): Promise<string | null> {
  const preparedText = cleanText(textContent)

  if (!preparedText) {
    return null
  }

  try {
    const { models: { translate }, name: providerName } = providerConfig
    const translateModel = translate.isCustomModel ? translate.customModel : translate.model
    const providerOptions = getProviderOptions(translateModel ?? '', providerName)
    const model = await getTranslateModelById(providerConfig.id)

    const prompt = `Summarize the following article in 2-3 sentences. Focus on the main topic and key points. Return ONLY the summary, no explanations or formatting.

Title: ${title}

Content:
${preparedText}`

    const { text: summary } = await generateText({
      model,
      prompt,
      providerOptions,
    })

    const cleanedSummary = summary.trim()
    logger.info('Generated article summary:', `${cleanedSummary.slice(0, 100)}...`)

    return cleanedSummary
  }
  catch (error) {
    logger.error('Failed to generate article summary:', error)
    return null
  }
}
