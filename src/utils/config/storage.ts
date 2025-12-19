import type { Config } from '@/types/config/config'
import type { ConfigMeta, ConfigValueAndMeta, LastSyncedConfigMeta, LastSyncedConfigValueAndMeta } from '@/types/config/meta'
import { storage } from '#imports'
import { configSchema } from '@/types/config/config'
import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY, DEFAULT_CONFIG, LAST_SYNCED_CONFIG_STORAGE_KEY } from '../constants/config'
import { logger } from '../logger'
import { migrateConfig } from './migration'

export async function getLocalConfig() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    logger.warn('No config found in storage')
    return null
  }
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    logger.error('Config is invalid, using default config')
    return DEFAULT_CONFIG
  }
  return parsedConfig.data
}

export async function setLocalConfig(config: Config) {
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    throw new Error('Config is invalid')
  }
  await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, parsedConfig.data)
  await storage.setMeta<Partial<ConfigMeta>>(`local:${CONFIG_STORAGE_KEY}`, { lastModifiedAt: Date.now() })
}

export async function getLocalConfigAndMeta(): Promise<ConfigValueAndMeta> {
  try {
    const [config, meta] = await Promise.all([
      storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`),
      storage.getMeta<ConfigMeta>(`local:${CONFIG_STORAGE_KEY}`),
    ])

    if (!config) {
      throw new Error('Local config not found')
    }

    const parsedConfig = configSchema.safeParse(config)
    if (!parsedConfig.success) {
      throw new Error('Local config is invalid')
    }

    return {
      value: parsedConfig.data,
      meta: {
        schemaVersion: meta?.schemaVersion ?? CONFIG_SCHEMA_VERSION,
        lastModifiedAt: meta?.lastModifiedAt ?? Date.now(),
      },
    }
  }
  catch (error) {
    logger.error('Failed to get local config', error)
    throw error
  }
}

export async function setLocalConfigAndMeta(config: Config, meta: Partial<ConfigMeta>) {
  const lastModifiedAt = meta.lastModifiedAt ?? Date.now()
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    throw new Error('Config is invalid')
  }
  await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, parsedConfig.data)
  await storage.setMeta<Partial<ConfigMeta>>(`local:${CONFIG_STORAGE_KEY}`, { ...meta, lastModifiedAt })
}

export async function getLastSyncedConfigAndMeta(): Promise<LastSyncedConfigValueAndMeta | null> {
  const [rawValue, meta] = await Promise.all([
    storage.getItem<unknown>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`),
    storage.getMeta<LastSyncedConfigMeta>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`),
  ])

  if (!rawValue || !meta) {
    return null
  }

  try {
    const value = await migrateConfig(rawValue, meta.schemaVersion)
    return { value, meta }
  }
  catch (error) {
    logger.error('Failed to migrate last synced config', error)
    return null
  }
}

export async function setLastSyncConfigAndMeta(value: Config, meta: Partial<LastSyncedConfigMeta>): Promise<void> {
  const lastSyncedAt = meta.lastSyncedAt ?? Date.now()

  await Promise.all([
    storage.setItem<Config>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, value),
    storage.setMeta<Partial<LastSyncedConfigMeta>>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, {
      ...meta,
      lastSyncedAt,
    }),
  ])
}
