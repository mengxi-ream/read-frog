import type { JSONValue } from 'ai'
import type { LLMTranslateProviderConfig } from '@/types/config/provider'
import { generateText } from 'ai'
import { THINKING_MODELS } from '@/types/config/provider'
import { getBatchTranslatePrompt, getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'

const DEFAULT_THINKING_BUDGET = 128

export async function aiTranslate(
  text: string,
  targetLangName: string,
  providerConfig: LLMTranslateProviderConfig,
  options?: { isBatch?: boolean },
) {
  const { id: providerId, models: { translate } } = providerConfig
  const translateModel = translate.isCustomModel ? translate.customModel : translate.model
  const model = await getTranslateModelById(providerId)

  const providerOptions: Record<string, Record<string, JSONValue>> = {
    google: {
      thinkingConfig: {
        thinkingBudget: THINKING_MODELS.includes(translateModel as (typeof THINKING_MODELS)[number]) ? DEFAULT_THINKING_BUDGET : 0,
      },
    },
  }

  const prompt = options?.isBatch
    ? await getBatchTranslatePrompt(targetLangName, text)
    : await getTranslatePrompt(targetLangName, text)

  const { text: translatedText } = await generateText({
    model,
    prompt,
    providerOptions,
  })

  const [, finalTranslation = translatedText] = translatedText.match(/<\/think>([\s\S]*)/) || []

  return finalTranslation
}
