import type { ConfigBackup } from '@/types/backup'
import type { Config } from '@/types/config/config'
import { storage } from '#imports'
import { configSchema } from '@/types/config/config'
import { migrateConfig } from '../config/migration'
import { CONFIG_SCHEMA_VERSION, CONFIG_SCHEMA_VERSION_STORAGE_KEY, CONFIG_STORAGE_KEY, LAST_SYNC_TIME_STORAGE_KEY, LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY, LAST_SYNCED_CONFIG_STORAGE_KEY } from '../constants/config'
import { logger } from '../logger'
import { downloadFile, findFileInAppData, uploadFile } from './api'
import { getValidAccessToken } from './auth'
import { detectConflicts } from './conflict-merge'

const GOOGLE_DRIVE_CONFIG_FILENAME = 'read-frog-config.json'

export interface ModifiedConfigData extends ConfigBackup {
  lastModified: number
}

interface ConfigMeta extends Record<string, unknown> {
  modifiedAt: number
}

export interface ConflictData {
  base: Config
  local: Config
  remote: Config
}

export class ConfigConflictError extends Error {
  name = 'ConfigConflictError'

  constructor(public data: ConflictData) {
    super('Config sync conflict detected')
  }
}

export class SyncMetadataCorruptedError extends Error {
  name = 'SyncMetadataCorruptedError'

  constructor(public appliedConfig: Config) {
    super('Sync metadata corrupted, applied remote config')
  }
}

async function getLocalConfig(): Promise<ModifiedConfigData> {
  try {
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)

    if (!config) {
      throw new Error('Local config not found')
    }

    const parsedConfig = configSchema.safeParse(config)
    if (!parsedConfig.success) {
      throw new Error('Local config is invalid')
    }

    const schemaVersion = await storage.getItem<number>(`local:${CONFIG_SCHEMA_VERSION_STORAGE_KEY}`) ?? CONFIG_SCHEMA_VERSION
    const meta = await storage.getMeta<ConfigMeta>(`local:${CONFIG_STORAGE_KEY}`)
    const lastModified = meta?.modifiedAt ?? Date.now()

    return {
      [CONFIG_STORAGE_KEY]: parsedConfig.data,
      [CONFIG_SCHEMA_VERSION_STORAGE_KEY]: schemaVersion,
      lastModified,
    }
  }
  catch (error) {
    logger.error('Failed to get local config', error)
    throw error
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  const lastSyncTime = await storage.getItem<number>(`local:${LAST_SYNC_TIME_STORAGE_KEY}`)
  return lastSyncTime ?? null
}

async function setLastSyncTime(timestamp: number): Promise<void> {
  await storage.setItem(`local:${LAST_SYNC_TIME_STORAGE_KEY}`, timestamp)
}

async function getLastSyncedConfig(): Promise<Config | null> {
  const lastSyncedConfig = await storage.getItem<Config>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`)
  return lastSyncedConfig ?? null
}

async function setLastSyncedConfig(config: Config): Promise<void> {
  await storage.setItem(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, config)
}

async function getLastSyncedConfigSchemaVersion(): Promise<number | null> {
  const lastSyncedConfigSchemaVersion = await storage.getItem<number>(`local:${LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY}`)
  return lastSyncedConfigSchemaVersion ?? null
}

async function setLastSyncedConfigSchemaVersion(schemaVersion: number): Promise<void> {
  await storage.setItem(`local:${LAST_SYNCED_CONFIG_SCHEMA_VERSION_STORAGE_KEY}`, schemaVersion)
}

interface SyncMetadata {
  timestamp: number
  config: Config
  schemaVersion: number
}

/**
 * Atomically update all sync metadata
 * - Updates last sync time
 * - Updates last synced config
 * - Updates last synced config schema version
 */
async function updateSyncMetadata({ timestamp, config, schemaVersion }: SyncMetadata): Promise<void> {
  await Promise.all([
    setLastSyncTime(timestamp),
    setLastSyncedConfig(config),
    setLastSyncedConfigSchemaVersion(schemaVersion),
  ])
}

async function getRemoteConfig(): Promise<ModifiedConfigData | null> {
  try {
    await getValidAccessToken()
    const file = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME)

    if (!file) {
      return null
    }

    const content = await downloadFile(file.id)
    const remoteData = JSON.parse(content) as ModifiedConfigData
    const remoteConfig = remoteData[CONFIG_STORAGE_KEY]
    const migratedConfig = await migrateConfig(remoteConfig, remoteData[CONFIG_SCHEMA_VERSION_STORAGE_KEY])
    const parsedConfig = configSchema.safeParse(migratedConfig)
    if (!parsedConfig.success) {
      throw new Error('Remote config is invalid')
    }

    return {
      [CONFIG_STORAGE_KEY]: parsedConfig.data,
      [CONFIG_SCHEMA_VERSION_STORAGE_KEY]: CONFIG_SCHEMA_VERSION,
      lastModified: remoteData.lastModified,
    }
  }
  catch (error) {
    logger.error('Failed to get remote config', error)
    throw error
  }
}

async function uploadLocalConfig(
  config: Config,
  schemaVersion: number,
  lastModified: number,
): Promise<void> {
  try {
    const existingFile = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME)

    const remoteData: ModifiedConfigData = {
      [CONFIG_STORAGE_KEY]: config,
      [CONFIG_SCHEMA_VERSION_STORAGE_KEY]: schemaVersion,
      lastModified,
    }

    const content = JSON.stringify(remoteData, null, 2)
    await uploadFile(GOOGLE_DRIVE_CONFIG_FILENAME, content, existingFile?.id)
  }
  catch (error) {
    logger.error('Failed to upload local config', error)
    throw error
  }
}

async function downloadRemoteConfig(remoteData: ModifiedConfigData): Promise<void> {
  try {
    let config: Config = remoteData[CONFIG_STORAGE_KEY]
    const remoteSchemaVersion = remoteData[CONFIG_SCHEMA_VERSION_STORAGE_KEY]

    // Migrate if remote schema version is older
    if (remoteSchemaVersion < CONFIG_SCHEMA_VERSION) {
      logger.info('Migrating remote config', {
        from: remoteSchemaVersion,
        to: CONFIG_SCHEMA_VERSION,
      })
      config = await migrateConfig(config, remoteSchemaVersion)
    }

    const validatedConfig = configSchema.parse(config)

    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, validatedConfig)
    await storage.setItem(`local:${CONFIG_SCHEMA_VERSION_STORAGE_KEY}`, CONFIG_SCHEMA_VERSION)
    await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, { modifiedAt: remoteData.lastModified })
  }
  catch (error) {
    logger.error('Failed to download remote config', error)
    throw error
  }
}

/**
 * Sync merged config after conflict resolution
 * - Save merged config to local storage
 * - Upload merged config to Google Drive
 * - Update last sync time and last synced config
 */
export async function syncMergedConfig(mergedConfig: Config): Promise<void> {
  try {
    const now = Date.now()

    // Validate merged config
    const validatedConfigResult = configSchema.safeParse(mergedConfig)
    if (!validatedConfigResult.success) {
      logger.error('Merged config is invalid, cannot sync merged config')
      throw new Error('Merged config is invalid for syncing')
    }

    const validatedConfig = validatedConfigResult.data

    // Save to local storage
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, validatedConfig)
    await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, { modifiedAt: now })

    // Upload to Google Drive
    await uploadLocalConfig(validatedConfig, CONFIG_SCHEMA_VERSION, now)

    // Update sync metadata
    await updateSyncMetadata({
      timestamp: now,
      config: validatedConfig,
      schemaVersion: CONFIG_SCHEMA_VERSION,
    })

    logger.info('Synced config successfully')
  }
  catch (error) {
    logger.error('Failed to sync config', error)
    throw error
  }
}

/**
 * Synchronize configuration between local and Google Drive
 * - Upload local config if remote doesn't exist
 * - Download remote config on first sync
 * - Sync based on last modified timestamp
 */
export async function syncConfig(): Promise<void> {
  try {
    const local = await getLocalConfig()
    const remote = await getRemoteConfig()

    if (!remote) {
      logger.info('No remote config found, uploading local config')
      await uploadLocalConfig(local[CONFIG_STORAGE_KEY], local[CONFIG_SCHEMA_VERSION_STORAGE_KEY], local.lastModified)
      await updateSyncMetadata({
        timestamp: Date.now(),
        config: local[CONFIG_STORAGE_KEY],
        schemaVersion: local[CONFIG_SCHEMA_VERSION_STORAGE_KEY],
      })
      return
    }

    const lastSyncTime = await getLastSyncTime()
    const lastSyncedConfigSchemaVersion = await getLastSyncedConfigSchemaVersion()
    const lastSyncedConfig = await getLastSyncedConfig()

    const isLastSyncValid = lastSyncTime !== null && lastSyncedConfigSchemaVersion !== null && lastSyncedConfig !== null

    if (!isLastSyncValid) {
      logger.warn('Last sync is invalid, applying remote config')
      await downloadRemoteConfig(remote)
      await updateSyncMetadata({
        timestamp: Date.now(),
        config: remote[CONFIG_STORAGE_KEY],
        schemaVersion: CONFIG_SCHEMA_VERSION,
      })

      // Only throw corruption error if lastSyncTime exists but other metadata is missing
      if (lastSyncTime !== null && (lastSyncedConfig === null || lastSyncedConfigSchemaVersion === null)) {
        throw new SyncMetadataCorruptedError(remote[CONFIG_STORAGE_KEY])
      }

      return
    }

    // Check if both local and remote changed since last sync
    const localChangedSinceSync = isLastSyncValid && local.lastModified > lastSyncTime
    const remoteChangedSinceSync = isLastSyncValid && remote.lastModified > lastSyncTime

    if (localChangedSinceSync && remoteChangedSinceSync) {
      logger.info('Both local and remote changed since last sync, checking for conflicts')
      const baseConfig = await getLastSyncedConfig() ?? local[CONFIG_STORAGE_KEY]

      if (!baseConfig) {
        logger.error('Base config not found, cannot perform conflict merge')
        throw new Error('Base config not found for conflict resolution')
      }

      const migratedBaseConfig = await migrateConfig(baseConfig, lastSyncedConfigSchemaVersion)

      const parsedMigratedBaseConfig = configSchema.safeParse(migratedBaseConfig)
      if (!parsedMigratedBaseConfig.success) {
        logger.error('Base config is invalid, cannot perform conflict merge')
        throw new Error('Base config is invalid for conflict resolution')
      }

      const { conflicts, merged } = detectConflicts(parsedMigratedBaseConfig.data, local[CONFIG_STORAGE_KEY], remote[CONFIG_STORAGE_KEY])

      if (conflicts.length === 0) {
        // No conflicts, auto-merge and sync
        logger.info('No conflicts detected, auto-merging configurations')
        const now = Date.now()

        // Save merged config to local storage
        await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, merged)
        await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, { modifiedAt: now })

        // Upload merged config to Google Drive
        await uploadLocalConfig(merged, CONFIG_SCHEMA_VERSION, now)

        // Update sync metadata
        await updateSyncMetadata({
          timestamp: now,
          config: merged,
          schemaVersion: CONFIG_SCHEMA_VERSION,
        })

        logger.info('Auto-merge completed successfully')
        return
      }

      // Conflicts detected, throw error for UI to handle
      logger.warn(`Conflicts detected: ${conflicts.length} conflicting fields`)

      throw new ConfigConflictError({
        base: migratedBaseConfig,
        local: local[CONFIG_STORAGE_KEY],
        remote: remote[CONFIG_STORAGE_KEY],
      })
    }

    if (remote.lastModified > local.lastModified) {
      logger.info('Remote config is newer, downloading remote config')
      await downloadRemoteConfig(remote)
      await updateSyncMetadata({
        timestamp: Date.now(),
        config: remote[CONFIG_STORAGE_KEY],
        schemaVersion: CONFIG_SCHEMA_VERSION,
      })
      return
    }

    if (local.lastModified > remote.lastModified) {
      logger.info('Local config is newer, uploading local config')
      await uploadLocalConfig(local[CONFIG_STORAGE_KEY], local[CONFIG_SCHEMA_VERSION_STORAGE_KEY], local.lastModified)
      await updateSyncMetadata({
        timestamp: Date.now(),
        config: local[CONFIG_STORAGE_KEY],
        schemaVersion: local[CONFIG_SCHEMA_VERSION_STORAGE_KEY],
      })
      return
    }

    logger.info('No changes, skipping sync')
    await updateSyncMetadata({
      timestamp: Date.now(),
      config: local[CONFIG_STORAGE_KEY],
      schemaVersion: local[CONFIG_SCHEMA_VERSION_STORAGE_KEY],
    })
  }
  catch (error) {
    logger.error('Config sync failed', error)
    throw error
  }
}
