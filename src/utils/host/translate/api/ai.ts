import type { LLMTranslateProviderConfig } from '@/types/config/provider'
import type { ArticleContent } from '@/types/content'
import { generateText } from 'ai'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'
import { getProviderOptionsWithOverride } from '@/utils/providers/options'

export async function aiTranslate(
  text: string,
  targetLangName: string,
  providerConfig: LLMTranslateProviderConfig,
  options?: { isBatch?: boolean, content?: ArticleContent },
) {
  const { id: providerId, models: { translate }, provider, providerOptions: userProviderOptions, temperature } = providerConfig
  const translateModel = translate.isCustomModel ? translate.customModel : translate.model
  const model = await getTranslateModelById(providerId)

  const providerOptions = getProviderOptionsWithOverride(translateModel ?? '', provider, userProviderOptions)
  const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, text, options)

  const { text: translatedText } = await generateText({
    model,
    system: systemPrompt,
    prompt,
    temperature,
    providerOptions,
    maxRetries: 0, // Disable SDK built-in retries, let RequestQueue/BatchQueue handle it
  })

  const [, finalTranslation = translatedText] = translatedText.match(/<\/think>([\s\S]*)/) || []

  return finalTranslation
}
