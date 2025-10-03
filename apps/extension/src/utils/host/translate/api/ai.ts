import type { LLMTranslateProviderConfig } from '@/types/config/provider'
import { generateText } from 'ai'
import { getProviderOptions } from '@/utils/constants/model'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'

export async function aiTranslate(
  text: string,
  targetLangName: string,
  providerConfig: LLMTranslateProviderConfig,
  options?: { isBatch?: boolean },
) {
  const { id: providerId, models: { translate } } = providerConfig
  const translateModel = translate.isCustomModel ? translate.customModel : translate.model
  const model = await getTranslateModelById(providerId)

  const providerOptions = getProviderOptions(translateModel ?? '')
  const prompt = await getTranslatePrompt(targetLangName, text, options)

  const { text: translatedText } = await generateText({
    model,
    prompt,
    providerOptions,
  })

  const [, finalTranslation = translatedText] = translatedText.match(/<\/think>([\s\S]*)/) || []

  return finalTranslation
}
