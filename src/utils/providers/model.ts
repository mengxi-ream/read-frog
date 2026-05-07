import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { createAlibaba } from "@ai-sdk/alibaba"
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { createAnthropic } from "@ai-sdk/anthropic"
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
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { createPerplexity } from "@ai-sdk/perplexity"
import { createReplicate } from "@ai-sdk/replicate"
import { createTogetherAI } from "@ai-sdk/togetherai"
import { createVercel } from "@ai-sdk/vercel"
import { createXai } from "@ai-sdk/xai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOllama } from "ollama-ai-provider-v2"
import { createMinimax } from "vercel-minimax-ai-provider"
import { isCustomLLMProvider } from "@/types/config/provider"
import { compactObject } from "@/types/utils"
import { getLLMProvidersConfig, getProviderConfigById } from "../config/helpers"
import { CONFIG_STORAGE_KEY } from "../constants/config"
import { getProviderHeadersWithOverride } from "./headers"
import { resolveModelId } from "./model-id"

const CREATE_AI_MAPPER = {
  "siliconflow": createOpenAICompatible,
  "tensdaq": createOpenAICompatible,
  "ai302": createOpenAICompatible,
  "volcengine": createOpenAICompatible,
  "openrouter": createOpenRouter,
  "openai-compatible": createOpenAICompatible,
  "openai": createOpenAI,
  "deepseek": createDeepSeek,
  "google": createGoogleGenerativeAI,
  "anthropic": createAnthropic,
  "xai": createXai,
  "bedrock": createAmazonBedrock,
  "groq": createGroq,
  "deepinfra": createDeepInfra,
  "mistral": createMistral,
  "togetherai": createTogetherAI,
  "cohere": createCohere,
  "fireworks": createFireworks,
  "cerebras": createCerebras,
  "replicate": createReplicate,
  "perplexity": createPerplexity,
  "vercel": createVercel,
  "ollama": createOllama,
  "minimax": createMinimax,
  "alibaba": createAlibaba,
  "moonshotai": createMoonshotAI,
  "huggingface": createHuggingFace,
} as const

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
  const providerSpecificSettings = "providerSpecificSettings" in providerConfig
    ? compactObject(providerConfig.providerSpecificSettings ?? {})
    : {}

  const provider = isCustomLLMProvider(providerConfig.provider)
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

  return provider.languageModel(modelId)
}

export async function getModelById(providerId: string) {
  return getLanguageModelById(providerId)
}
