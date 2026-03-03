import type { LLMProviderConfig } from "@/types/config/provider"
import type { ArticleContent } from "@/types/content"
import type { TranslatePromptOptions, TranslatePromptResult } from "@/utils/prompts/translate"
import { generateText } from "ai"
import { extractAISDKErrorMessage } from "@/utils/error/extract-message"
import { getModelById, resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"

export type PromptResolver = (
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions,
) => Promise<TranslatePromptResult>

export interface TranslationUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface TranslationResult {
  text: string
  usage?: TranslationUsage
}

export async function aiTranslate(
  text: string,
  targetLangName: string,
  providerConfig: LLMProviderConfig,
  promptResolver: PromptResolver,
  options?: { isBatch?: boolean, content?: ArticleContent },
): Promise<TranslationResult> {
  const { id: providerId, model: providerModel, provider, providerOptions: userProviderOptions, temperature } = providerConfig
  const modelName = resolveModelId(providerModel)
  const model = await getModelById(providerId)

  const providerOptions = getProviderOptionsWithOverride(modelName ?? "", provider, userProviderOptions)
  const { systemPrompt, prompt } = await promptResolver(targetLangName, text, options)

  try {
    const { text: translatedText, usage } = await generateText({
      model,
      system: systemPrompt,
      prompt,
      temperature,
      providerOptions,
      maxRetries: 0, // Disable SDK built-in retries, let RequestQueue/BatchQueue handle it
    })

    const [, finalTranslation = translatedText] = translatedText.match(/<\/think>([\s\S]*)/) || []

    return {
      text: finalTranslation,
      usage: usage
        ? {
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          }
        : undefined,
    }
  }
  catch (error) {
    throw new Error(extractAISDKErrorMessage(error))
  }
}
