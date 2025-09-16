import type { Config } from '@/types/config/config'
import { storage } from '#imports'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getLLMTranslateProvidersConfig, getProviderConfigById } from '../config/helpers'
import { CONFIG_STORAGE_KEY } from '../constants/config'

interface ProviderFactoryMap {
  openai: typeof createOpenAI
  deepseek: typeof createDeepSeek
  gemini: typeof createGoogleGenerativeAI
  openaiCompatible: typeof createOpenAICompatible
}

const CREATE_AI_MAPPER: ProviderFactoryMap = {
  openai: createOpenAI,
  deepseek: createDeepSeek,
  gemini: createGoogleGenerativeAI,
  openaiCompatible: createOpenAICompatible,
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

  const provider = providerConfig.provider === 'openaiCompatible'
    ? CREATE_AI_MAPPER[providerConfig.provider]({
        name: providerConfig.name,
        baseURL: providerConfig.baseURL,
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
