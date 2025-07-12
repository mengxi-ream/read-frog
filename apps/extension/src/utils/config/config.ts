import type { Config } from '@/types/config/config'

import type { APIProviderNames, ProvidersConfig } from '@/types/config/provider'

import { configSchema } from '@/types/config/config'
import {
  CONFIG_STORAGE_KEY,
} from '../constants/config'

// eslint-disable-next-line import/no-mutable-exports
export let globalConfig: Config | null = null

export async function loadGlobalConfig() {
  const config = await sendMessage('getInitialConfig', undefined)
  if (configSchema.safeParse(config).success) {
    logger.info('Loaded global config', config)
    globalConfig = config
  }
}

storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newConfig) => {
  if (configSchema.safeParse(newConfig).success) {
    globalConfig = newConfig
  }
})

export function isAnyAPIKey(providersConfig: ProvidersConfig) {
  return Object.values(providersConfig).some((providerConfig) => {
    return providerConfig.apiKey
  })
}

export function hasSetAPIKey(provider: APIProviderNames, providersConfig: ProvidersConfig) {
  return providersConfig[provider]?.apiKey !== undefined
}
