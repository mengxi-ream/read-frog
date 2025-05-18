import type { Config } from '@/types/config/config'

import type { ReadProviderNames, translateProviderModels } from '@/types/config/provider'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAI } from '@ai-sdk/openai'

import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { createProviderRegistry } from 'ai'
import { CONFIG_STORAGE_KEY, DEFAULT_PROVIDER_CONFIG } from './constants/config'

export async function getProviderRegistry() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)

  return createProviderRegistry({
    openai: createOpenAI({
      baseURL: config?.providersConfig?.openai?.baseURL ?? DEFAULT_PROVIDER_CONFIG.openai.baseURL,
      apiKey: config?.providersConfig?.openai.apiKey,
    }),
    deepseek: createDeepSeek({
      baseURL: config?.providersConfig?.deepseek.baseURL ?? DEFAULT_PROVIDER_CONFIG.deepseek.baseURL,
      apiKey: config?.providersConfig?.deepseek.apiKey,
    }),
  })
}

export async function getTranslateModel(provider: keyof typeof translateProviderModels, model: string) {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  const registry = await getProviderRegistry()
  const openrouter = createOpenRouter({
    apiKey: config?.providersConfig?.openrouter.apiKey,
    baseURL: config?.providersConfig?.openrouter.baseURL ?? DEFAULT_PROVIDER_CONFIG.openrouter.baseURL,
  })
  if (provider === 'openrouter') {
    return openrouter.languageModel(model)
  }
  return registry.languageModel(`${provider}:${model}`)
}

export async function getReadModel(provider: ReadProviderNames, model: string) {
  const registry = await getProviderRegistry()
  return registry.languageModel(`${provider}:${model}`)
}
