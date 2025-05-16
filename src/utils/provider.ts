import type { Config } from '@/types/config/config'

import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAI } from '@ai-sdk/openai'

import { createProviderRegistry } from 'ai'

import { CONFIG_STORAGE_KEY } from './constants/config'

export async function getProviderRegistry() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)

  return createProviderRegistry({
    openai: createOpenAI({
      apiKey: config?.providersConfig?.openai.apiKey,
    }),
    deepseek: createDeepSeek({
      apiKey: config?.providersConfig?.deepseek.apiKey,
    }),
  })
}
