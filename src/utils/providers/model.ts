import type { Config } from "@/types/config/config"
import type { ApiMode, LLMProviderConfig } from "@/types/config/provider"
import { createAlibaba } from "@ai-sdk/alibaba"
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createAzure } from "@ai-sdk/azure"
import { createCerebras } from "@ai-sdk/cerebras"
import { createCohere } from "@ai-sdk/cohere"
import { createDeepInfra } from "@ai-sdk/deepinfra"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createFireworks } from "@ai-sdk/fireworks"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createHuggingFace } from "@ai-sdk/huggingface"
import { createMistral } from "@ai-sdk/mistral"
import { createMoonshotAI } from "@ai-sdk/moonshotai"
import { createOpenResponses } from "@ai-sdk/open-responses"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createPerplexity } from "@ai-sdk/perplexity"
import { createReplicate } from "@ai-sdk/replicate"
import { createTogetherAI } from "@ai-sdk/togetherai"
import { createVercel } from "@ai-sdk/vercel"
import { createXai } from "@ai-sdk/xai"
import { createOllama } from "ai-sdk-ollama"
import { storage } from "#imports"
import {
  DEFAULT_AZURE_API_MODE,
  DEFAULT_CUSTOM_API_MODE,
  isCustomLLMProvider,
} from "@/types/config/provider"
import { compactObject } from "@/types/utils"
import { getLLMProvidersConfig, getProviderConfigById } from "../config/helpers"
import { CONFIG_STORAGE_KEY } from "../constants/config"
import { getProviderHeadersWithOverride } from "./headers"
import { resolveModelId } from "./model-id"
import { resolveResponsesUrl } from "./responses-url"

const CREATE_AI_MAPPER = {
  atlascloud: createOpenAICompatible,
  siliconflow: createOpenAICompatible,
  tensdaq: createOpenAICompatible,
  volcengine: createOpenAICompatible,
  "openai-compatible": createOpenAICompatible,
  openrouter: createOpenAICompatible,
  minimax: createOpenAICompatible,
  openai: createOpenAI,
  azure: createAzure,
  deepseek: createDeepSeek,
  google: createGoogleGenerativeAI,
  anthropic: createAnthropic,
  xai: createXai,
  bedrock: createAmazonBedrock,
  groq: createGroq,
  deepinfra: createDeepInfra,
  mistral: createMistral,
  togetherai: createTogetherAI,
  cohere: createCohere,
  fireworks: createFireworks,
  cerebras: createCerebras,
  replicate: createReplicate,
  perplexity: createPerplexity,
  vercel: createVercel,
  ollama: createOllama,
  alibaba: createAlibaba,
  moonshotai: createMoonshotAI,
  huggingface: createHuggingFace,
} as const

function getProviderSpecificSettings(providerConfig: LLMProviderConfig) {
  const settings =
    "providerSpecificSettings" in providerConfig
      ? compactObject(providerConfig.providerSpecificSettings ?? {})
      : {}

  if (providerConfig.provider !== "azure" && providerConfig.provider !== "openai-compatible") {
    return settings
  }

  const { apiMode: _apiMode, ...providerSettings } = settings as Record<string, unknown>
  return providerSettings
}

function getApiMode(
  providerConfig: Extract<LLMProviderConfig, { provider: "azure" | "openai-compatible" }>,
): ApiMode {
  const defaultApiMode =
    providerConfig.provider === "azure" ? DEFAULT_AZURE_API_MODE : DEFAULT_CUSTOM_API_MODE
  const apiMode = (providerConfig.providerSpecificSettings as { apiMode?: unknown } | undefined)
    ?.apiMode
  return apiMode === "chat" || apiMode === "responses" ? apiMode : defaultApiMode
}

async function getLanguageModelById(providerId: string) {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    throw new Error("Config not found")
  }

  const LLMProvidersConfig = getLLMProvidersConfig(config.providersConfig)
  const providerConfig = getProviderConfigById(LLMProvidersConfig, providerId)
  if (!providerConfig) {
    throw new Error(`Provider ${providerId} not found`)
  }

  const headers = getProviderHeadersWithOverride(providerConfig.provider, providerConfig.headers)
  const providerSpecificSettings = getProviderSpecificSettings(providerConfig)

  const provider =
    providerConfig.provider === "openai-compatible" && getApiMode(providerConfig) === "responses"
      ? createOpenResponses({
          name: providerConfig.provider,
          url: resolveResponsesUrl(providerConfig.baseURL),
          ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
          ...(headers && { headers }),
        })
      : isCustomLLMProvider(providerConfig.provider)
        ? CREATE_AI_MAPPER[providerConfig.provider]({
            ...providerSpecificSettings,
            name: providerConfig.provider,
            baseURL: providerConfig.baseURL ?? "",
            supportsStructuredOutputs: true,
            ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
            ...(headers && { headers }),
          })
        : CREATE_AI_MAPPER[providerConfig.provider]({
            ...providerSpecificSettings,
            ...(providerConfig.baseURL && { baseURL: providerConfig.baseURL }),
            ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
            ...(headers && { headers }),
          })

  const modelId = resolveModelId(providerConfig.model)

  if (!modelId) {
    throw new Error("Model is undefined")
  }

  if (providerConfig.provider === "azure" && getApiMode(providerConfig) === "chat") {
    return (provider as ReturnType<typeof createAzure>).chat(modelId)
  }

  if (providerConfig.provider === "ollama") {
    return (provider as ReturnType<typeof createOllama>).languageModel(modelId, { think: false })
  }

  return provider.languageModel(modelId)
}

export async function getModelById(providerId: string) {
  return getLanguageModelById(providerId)
}
