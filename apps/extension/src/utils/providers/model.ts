import type { Config } from '@/types/config/config'
import { storage } from '#imports'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createCerebras } from '@ai-sdk/cerebras'
import { createCohere } from '@ai-sdk/cohere'
import { createDeepInfra } from '@ai-sdk/deepinfra'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createPerplexity } from '@ai-sdk/perplexity'
import { createReplicate } from '@ai-sdk/replicate'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createVercel } from '@ai-sdk/vercel'
import { createXai } from '@ai-sdk/xai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ai-sdk-ollama'
import { isCustomLLMProvider } from '@/types/config/provider'
import { getLLMTranslateProvidersConfig, getProviderConfigById } from '../config/helpers'
import { CONFIG_STORAGE_KEY } from '../constants/config'

interface ProviderFactoryMap {
  siliconflow: typeof createOpenAICompatible
  tensdaq: typeof createOpenAICompatible
  ai302: typeof createOpenAICompatible
  openrouter: typeof createOpenRouter
  openaiCompatible: typeof createOpenAICompatible
  openai: typeof createOpenAI
  deepseek: typeof createDeepSeek
  gemini: typeof createGoogleGenerativeAI
  anthropic: typeof createAnthropic
  grok: typeof createXai
  amazonBedrock: typeof createAmazonBedrock
  groq: typeof createGroq
  deepinfra: typeof createDeepInfra
  mistral: typeof createMistral
  togetherai: typeof createTogetherAI
  cohere: typeof createCohere
  fireworks: typeof createFireworks
  cerebras: typeof createCerebras
  replicate: typeof createReplicate
  perplexity: typeof createPerplexity
  vercel: typeof createVercel
  ollama: typeof createOllama
}

const CREATE_AI_MAPPER: ProviderFactoryMap = {
  siliconflow: createOpenAICompatible,
  tensdaq: createOpenAICompatible,
  ai302: createOpenAICompatible,
  openrouter: createOpenRouter,
  openaiCompatible: createOpenAICompatible,
  openai: createOpenAI,
  deepseek: createDeepSeek,
  gemini: createGoogleGenerativeAI,
  anthropic: createAnthropic,
  grok: createXai,
  amazonBedrock: createAmazonBedrock,
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
}

async function getLanguageModelById(providerId: string, modelType: 'read' | 'translate') {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    throw new Error('Config not found')
  }

  const LLMProvidersConfig = getLLMTranslateProvidersConfig(config.providersConfig)
  const providerConfig = getProviderConfigById(LLMProvidersConfig, providerId)
  if (!providerConfig) {
    throw new Error(`Provider ${providerId} not found`)
  }

  const provider = isCustomLLMProvider(providerConfig.provider)
    ? CREATE_AI_MAPPER[providerConfig.provider]({
        name: providerConfig.name,
        baseURL: providerConfig.baseURL ?? '',
        ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
      })
    : CREATE_AI_MAPPER[providerConfig.provider]({
        ...(providerConfig.baseURL && { baseURL: providerConfig.baseURL }),
        ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
      })

  const modelConfig = providerConfig.models[modelType]
  const modelId = modelConfig.isCustomModel
    ? modelConfig.customModel
    : modelConfig.model

  if (!modelId) {
    throw new Error(`Model is undefined for ${modelType}`)
  }

  return provider.languageModel(modelId)
}

export async function getTranslateModelById(providerId: string) {
  return getLanguageModelById(providerId, 'translate')
}

export async function getReadModelById(providerId: string) {
  return getLanguageModelById(providerId, 'read')
}
