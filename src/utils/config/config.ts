import type { Config } from '@/types/config/config'

import type { APIProviderNames, ProvidersConfig } from '@/types/config/provider'

import { configSchema } from '@/types/config/config'
import {
  CONFIG_SCHEMA_VERSION,
  CONFIG_STORAGE_KEY,
  DEFAULT_CONFIG,
} from '../constants/config'
import { runMigration } from './migration'

// eslint-disable-next-line import/no-mutable-exports
export let globalConfig: Config | null = null
export const loadGlobalConfigPromise = initializeConfig()

export async function initializeConfig() {
  const [storedConfig, storedCSchemaVersion] = await Promise.all([
    storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`),
    storage.getItem<number>(`local:__configSchemaVersion`),
  ])

  let config: Config | null = storedConfig
  let currentVersion = storedCSchemaVersion ?? 1

  if (!config) {
    logger.info('No config found, using default config')
    logger.info('Default config:', DEFAULT_CONFIG)
    config = DEFAULT_CONFIG
    currentVersion = CONFIG_SCHEMA_VERSION
  }

  while (currentVersion < CONFIG_SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1
    try {
      config = await runMigration(nextVersion, config)
      currentVersion = nextVersion
    }
    catch (error) {
      console.error(`Migration to version ${nextVersion} failed:`, error)
      currentVersion = nextVersion
    }
  }

  if (!configSchema.safeParse(config).success) {
    logger.warn('Config is invalid, using default config')
    config = DEFAULT_CONFIG
    currentVersion = CONFIG_SCHEMA_VERSION
  }

  await Promise.all([
    storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, config),
    storage.setItem<number>(`local:__configSchemaVersion`, currentVersion),
  ])

  globalConfig = config
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

export async function loadAPIKeyFromEnv() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    return
  }

  if (import.meta.env.DEV) {
    const newProviderConfig = Object.fromEntries(
      Object.entries(config.providersConfig).map(([provider, cfg]) => {
        const apiKeyEnvName = `WXT_${provider.toUpperCase()}_API_KEY`
        return [provider, { ...cfg, apiKey: import.meta.env[apiKeyEnvName] }]
      }),
    )
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...config,
      providersConfig: newProviderConfig,
    })
  }
}
