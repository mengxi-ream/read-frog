import type { BackgroundTextStreamSnapshot } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, ProviderConfig } from "@/types/config/provider"
import type { WebPagePromptContext } from "@/types/content"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { isLLMProviderConfig } from "@/types/config/provider"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { normalizeTranslationOutput } from "@/utils/host/translate/translation-output-normalization"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"

interface TranslationHubTranslateOptions {
  signal?: AbortSignal
  onChunk?: (data: BackgroundTextStreamSnapshot) => void
}

async function streamLLMTranslation(
  text: string,
  langConfig: Config["language"],
  providerConfig: LLMProviderConfig,
  translateConfig: Config["translate"],
  options: TranslationHubTranslateOptions,
) {
  const preparedText = prepareTranslationText(text)
  if (preparedText === "")
    return ""

  const targetLangName = LANG_CODE_TO_EN_NAME[langConfig.targetCode]
  const {
    id: providerId,
    provider,
    providerOptions: userProviderOptions,
    temperature,
  } = providerConfig
  const modelName = resolveModelId(providerConfig.model)
  const providerOptions = getProviderOptionsWithOverride(modelName ?? "", provider, userProviderOptions)
  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    translateConfig,
    targetLangName,
    preparedText,
  )

  const result = await streamBackgroundText(
    {
      providerId,
      system: systemPrompt,
      prompt,
      providerOptions,
      temperature,
    },
    {
      signal: options.signal,
      onChunk: options.onChunk,
    },
  )

  return normalizeTranslationOutput(providerConfig, result.output).trim()
}

export function translateForTranslationHub(
  text: string,
  langConfig: Config["language"],
  providerConfig: ProviderConfig,
  translateConfig: Config["translate"],
  options: TranslationHubTranslateOptions = {},
) {
  if (isLLMProviderConfig(providerConfig)) {
    return streamLLMTranslation(text, langConfig, providerConfig, translateConfig, options)
  }

  return executeTranslate<WebPagePromptContext>(
    text,
    langConfig,
    providerConfig,
    async (targetLang, input, promptOptions) =>
      getTranslatePromptFromConfig(translateConfig, targetLang, input, promptOptions),
  )
}
