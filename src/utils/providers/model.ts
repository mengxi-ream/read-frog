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
  "kimi-coding": createAnthropic,
  "huggingface": createHuggingFace,
} as const

const CUSTOM_HEADER_MAP: Partial<Record<keyof typeof CREATE_AI_MAPPER, Record<string, string>>> = {
  "anthropic": { "anthropic-dangerous-direct-browser-access": "true" },
  "kimi-coding": { "User-Agent": "claude-code/0.1.0" },
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

  const customHeaders = CUSTOM_HEADER_MAP[providerConfig.provider]
  const connectionOptions = compactObject(providerConfig.connectionOptions ?? {})

  const baseOptions: Record<string, unknown> = {
    ...connectionOptions,
    ...(providerConfig.baseURL && { baseURL: providerConfig.baseURL }),
    ...(customHeaders && { headers: customHeaders }),
  }

  if (providerConfig.apiKey) {
    // Kimi Coding endpoint expects Authorization: Bearer instead of x-api-key
    if (providerConfig.provider === "kimi-coding") {
      baseOptions.authToken = providerConfig.apiKey
    }
    else {
      baseOptions.apiKey = providerConfig.apiKey
    }
  }

  const provider = isCustomLLMProvider(providerConfig.provider)
    ? CREATE_AI_MAPPER[providerConfig.provider]({
        ...baseOptions,
        name: providerConfig.provider,
        baseURL: providerConfig.baseURL ?? "",
        supportsStructuredOutputs: true,
      })
    : CREATE_AI_MAPPER[providerConfig.provider](baseOptions)

  const modelId = resolveModelId(providerConfig.model)

  if (!modelId) {
    throw new Error("Model is undefined")
  }

  return provider.languageModel(modelId)
}

export async function getModelById(providerId: string) {
  return getLanguageModelById(providerId)
}
