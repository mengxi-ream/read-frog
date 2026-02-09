import type { LLMTranslateProviderConfig } from '@/types/config/provider'
import type { ArticleContent } from '@/types/content'
import type { TranslatePromptOptions, TranslatePromptResult } from '@/utils/prompts/translate'
import { generateText } from 'ai'
import { getModelById } from '@/utils/providers/model'
import { getProviderOptionsWithOverride } from '@/utils/providers/options'

export type PromptResolver = (
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions,
) => Promise<TranslatePromptResult>

export async function aiTranslate(
  text: string,
  targetLangName: string,
  providerConfig: LLMTranslateProviderConfig,
  promptResolver: PromptResolver,
  options?: { isBatch?: boolean, content?: ArticleContent },
) {
  const { id: providerId, model: providerModel, provider, providerOptions: userProviderOptions, temperature } = providerConfig
  const modelName = providerModel.isCustomModel ? providerModel.customModel : providerModel.model
  const model = await getModelById(providerId)

  const providerOptions = getProviderOptionsWithOverride(modelName ?? '', provider, userProviderOptions)
  const { systemPrompt, prompt } = await promptResolver(targetLangName, text, options)

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
