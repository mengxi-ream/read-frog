import type { LanguageModel } from 'ai'
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
import { createOllama } from 'ollama-ai-provider-v2'
import { createMinimax } from 'vercel-minimax-ai-provider'
import { isCustomLLMProvider } from '@/types/config/provider'
import { getLLMTranslateProvidersConfig, getProviderConfigById, getTTSProvidersConfig } from '../config/helpers'
import { CONFIG_STORAGE_KEY } from '../constants/config'

interface ProviderFactoryMap {
  'siliconflow': typeof createOpenAICompatible
  'tensdaq': typeof createOpenAICompatible
  'ai302': typeof createOpenAICompatible
  'volcengine': typeof createOpenAICompatible
  'openrouter': typeof createOpenRouter
  'openai-compatible': typeof createOpenAICompatible
  'openai': typeof createOpenAI
  'deepseek': typeof createDeepSeek
  'google': typeof createGoogleGenerativeAI
  'anthropic': typeof createAnthropic
  'xai': typeof createXai
  'bedrock': typeof createAmazonBedrock
  'groq': typeof createGroq
  'deepinfra': typeof createDeepInfra
  'mistral': typeof createMistral
  'togetherai': typeof createTogetherAI
  'cohere': typeof createCohere
  'fireworks': typeof createFireworks
  'cerebras': typeof createCerebras
  'replicate': typeof createReplicate
  'perplexity': typeof createPerplexity
  'vercel': typeof createVercel
  'ollama': typeof createOllama
  'minimax': typeof createMinimax
}

const CREATE_AI_MAPPER: ProviderFactoryMap = {
  'siliconflow': createOpenAICompatible,
  'tensdaq': createOpenAICompatible,
  'ai302': createOpenAICompatible,
  'volcengine': createOpenAICompatible,
  'openrouter': createOpenRouter,
  'openai-compatible': createOpenAICompatible,
  'openai': createOpenAI,
  'deepseek': createDeepSeek,
  'google': createGoogleGenerativeAI,
  'anthropic': createAnthropic,
  'xai': createXai,
  'bedrock': createAmazonBedrock,
  'groq': createGroq,
  'deepinfra': createDeepInfra,
  'mistral': createMistral,
  'togetherai': createTogetherAI,
  'cohere': createCohere,
  'fireworks': createFireworks,
  'cerebras': createCerebras,
  'replicate': createReplicate,
  'perplexity': createPerplexity,
  'vercel': createVercel,
  'ollama': createOllama,
  'minimax': createMinimax,
}

const CUSTOM_HEADER_MAP: Partial<Record<keyof ProviderFactoryMap, Record<string, string>>> = {
  anthropic: { 'anthropic-dangerous-direct-browser-access': 'true' },
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

  const customHeaders = CUSTOM_HEADER_MAP[providerConfig.provider]

  const provider = isCustomLLMProvider(providerConfig.provider)
    ? CREATE_AI_MAPPER[providerConfig.provider]({
        name: providerConfig.provider,
        baseURL: providerConfig.baseURL ?? '',
        ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
        ...(customHeaders && { headers: customHeaders }),
      })
    : CREATE_AI_MAPPER[providerConfig.provider]({
        ...(providerConfig.baseURL && { baseURL: providerConfig.baseURL }),
        ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
        ...(customHeaders && { headers: customHeaders }),
      })

  const modelConfig = providerConfig.models[modelType]
  const modelId = modelConfig.isCustomModel
    ? modelConfig.customModel
    : modelConfig.model

  if (!modelId) {
    throw new Error(`Model is undefined for ${modelType}`)
  }

  // TODO: remove `as LanguageModel` after openrouter provider is compatible with AI SDK v6
  return provider.languageModel(modelId) as LanguageModel
}

export async function getTranslateModelById(providerId: string) {
  return getLanguageModelById(providerId, 'translate')
}

export async function getReadModelById(providerId: string) {
  return getLanguageModelById(providerId, 'read')
}

export async function getTTSProviderById(providerId: string) {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    throw new Error('Config not found')
  }

  const ttsProvidersConfig = getTTSProvidersConfig(config.providersConfig)
  const providerConfig = getProviderConfigById(ttsProvidersConfig, providerId)
  if (!providerConfig) {
    throw new Error(`Provider ${providerId} not found`)
  }

  const customHeaders = CUSTOM_HEADER_MAP[providerConfig.provider]

  const provider = CREATE_AI_MAPPER[providerConfig.provider]({
    ...(providerConfig.baseURL && { baseURL: providerConfig.baseURL }),
    ...(providerConfig.apiKey && { apiKey: providerConfig.apiKey }),
    ...(customHeaders && { headers: customHeaders }),
  })

  return provider
}
