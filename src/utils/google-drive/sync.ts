import type { UnresolvedData } from '../atoms/google-drive-sync'
import type { Config } from '@/types/config/config'
import type { ConfigMeta, ConfigValueAndMeta, LastSyncedConfigMeta, LastSyncedConfigMetaFields, LastSyncedConfigValueAndMeta } from '@/types/config/meta'
import { storage } from '#imports'
import { configSchema } from '@/types/config/config'
import { setConfigToStorage } from '../config/config'
import { migrateConfig } from '../config/migration'
import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY, LAST_SYNCED_CONFIG_STORAGE_KEY } from '../constants/config'
import { logger } from '../logger'
import { downloadFile, findFileInAppData, uploadFile } from './api'
import { getGoogleUserInfo, getValidAccessToken } from './auth'
import { detectChanges } from './conflict-merge'

const GOOGLE_DRIVE_CONFIG_FILENAME = 'read-frog-config.json'

export type SyncAction = 'uploaded' | 'downloaded' | 'merged' | 'no-change'

export type SyncResult
  = | { status: 'success', action: SyncAction }
    | { status: 'unresolved', data: UnresolvedData }
    | { status: 'error', error: Error }

async function getLocalConfigAndMeta(): Promise<ConfigValueAndMeta> {
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

async function getLastSyncedConfigAndMeta(): Promise<LastSyncedConfigValueAndMeta | null> {
  const [rawValue, meta] = await Promise.all([
    storage.getItem<unknown>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`),
    storage.getMeta<LastSyncedConfigMeta>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`),
  ])

  if (!rawValue || !meta) {
    return null
  }

  const value = await migrateConfig(rawValue, meta.schemaVersion)
  return { value, meta }
}

interface LastSyncConfigAndMetaParams {
  value: Config
  meta: Omit<LastSyncedConfigMetaFields, 'lastSyncedAt'> & { lastSyncedAt?: number }
}

/**
 * Update all sync metadata atomically
 * - Updates lastSyncedConfig with its meta (schemaVersion, lastModifiedAt, lastSyncedAt, email)
 */
async function updateLastSyncConfigAndMeta({ value, meta }: LastSyncConfigAndMetaParams): Promise<void> {
  const lastSyncedAt = meta.lastSyncedAt ?? Date.now()

  await Promise.all([
    storage.setItem(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, value),
    storage.setMeta(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, {
      ...meta,
      lastSyncedAt,
    } satisfies LastSyncedConfigMeta),
  ])
}

async function getRemoteConfigAndMetaWithUserEmail(): Promise<{
  configValueAndMeta: ConfigValueAndMeta | null
  email: string
}> {
  try {
    const accessToken = await getValidAccessToken()

    // Fetch user email from Google API
    const userInfo = await getGoogleUserInfo(accessToken)

    const file = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME)

    if (!file) {
      return { configValueAndMeta: null, email: userInfo.email }
    }

    const content = await downloadFile(file.id)
    const remoteData = JSON.parse(content) as ConfigValueAndMeta

    let migratedConfig: Config
    try {
      migratedConfig = await migrateConfig(remoteData.value, remoteData.meta.schemaVersion)
    }
    catch (error) {
      logger.error('Failed to migrate remote config', error)
      return { configValueAndMeta: null, email: userInfo.email }
    }

    return {
      configValueAndMeta: {
        value: migratedConfig,
        meta: {
          schemaVersion: CONFIG_SCHEMA_VERSION,
          lastModifiedAt: remoteData.meta.lastModifiedAt,
        },
      },
      email: userInfo.email,
    }
  }
  catch (error) {
    logger.error('Failed to get remote config', error)
    throw error
  }
}

async function uploadConfig(
  configValueAndMeta: ConfigValueAndMeta,
): Promise<void> {
  try {
    const existingFile = await findFileInAppData(GOOGLE_DRIVE_CONFIG_FILENAME)

    const content = JSON.stringify(configValueAndMeta, null, 2)
    await uploadFile(GOOGLE_DRIVE_CONFIG_FILENAME, content, existingFile?.id)
  }
  catch (error) {
    logger.error('Failed to upload local config', error)
    throw error
  }
}

// TODO: should it just be normal call to save config to storage?
async function saveConfigValueAndMeta(configValueAndMeta: ConfigValueAndMeta): Promise<void> {
  try {
    const { value, meta } = configValueAndMeta

    const validatedConfig = configSchema.parse(value)

    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, validatedConfig)
    await storage.setMeta(`local:${CONFIG_STORAGE_KEY}`, meta)
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
export async function syncMergedConfig(mergedConfig: Config, email: string): Promise<void> {
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
    await setConfigToStorage(validatedConfig)

    // Upload to Google Drive
    await uploadConfig({
      value: validatedConfig,
      meta: { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now },
    })

    // Update sync metadata
    await updateLastSyncConfigAndMeta({
      value: validatedConfig,
      meta: { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now, email },
    })

    logger.info('Synced config successfully')
  }
  catch (error) {
    logger.error('Failed to sync config', error)
    throw error
  }
}

export async function syncConfig(): Promise<SyncResult> {
  try {
    const localConfigValueAndMeta = await getLocalConfigAndMeta()
    const lastSyncedConfigValueAndMeta = await getLastSyncedConfigAndMeta()
    const { configValueAndMeta: remoteConfigValueAndMeta, email } = await getRemoteConfigAndMetaWithUserEmail()

    if (email !== lastSyncedConfigValueAndMeta?.meta.email) {
      if (remoteConfigValueAndMeta) {
        logger.info('Remote config found, saving remote config')
        await saveConfigValueAndMeta(remoteConfigValueAndMeta)
        await updateLastSyncConfigAndMeta({
          value: remoteConfigValueAndMeta.value,
          meta: { ...remoteConfigValueAndMeta.meta, email, lastSyncedAt: Date.now() },
        })
        return { status: 'success', action: 'downloaded' }
      }
      else {
        logger.info('No remote config found, uploading local config')
        await uploadConfig(localConfigValueAndMeta)
        await updateLastSyncConfigAndMeta({
          value: localConfigValueAndMeta.value,
          meta: { ...localConfigValueAndMeta.meta, email, lastSyncedAt: Date.now() },
        })
        return { status: 'success', action: 'uploaded' }
      }
    }

    // Check if both local and remote changed since last sync
    const localChangedSinceSync = localConfigValueAndMeta.meta.lastModifiedAt > lastSyncedConfigValueAndMeta.meta.lastModifiedAt
    const remoteChangedSinceSync = remoteConfigValueAndMeta && remoteConfigValueAndMeta.meta.lastModifiedAt > lastSyncedConfigValueAndMeta.meta.lastModifiedAt

    if (localChangedSinceSync && remoteChangedSinceSync) {
      logger.info('Both local and remote changed since last sync, checking for conflicts')

      const { conflicts, merged } = detectChanges(
        lastSyncedConfigValueAndMeta.value,
        localConfigValueAndMeta.value,
        remoteConfigValueAndMeta.value,
      )

      const validatedMergedConfig = configSchema.safeParse(merged)

      // even if there are no conflicts, there might still be some stricter validation errors, so we need to check that
      if (conflicts.length === 0 && validatedMergedConfig.success) {
        // No conflicts, auto-merge and sync
        logger.info('No conflicts detected, auto-merging configurations')
        const now = Date.now()

        const mergedConfigValueAndMeta = {
          value: validatedMergedConfig.data,
          meta: { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now },
        }

        await saveConfigValueAndMeta(mergedConfigValueAndMeta)
        await uploadConfig(mergedConfigValueAndMeta)
        await updateLastSyncConfigAndMeta({
          value: mergedConfigValueAndMeta.value,
          meta: { ...mergedConfigValueAndMeta.meta, email, lastSyncedAt: now },
        })

        logger.info('Auto-merge completed successfully')
        return { status: 'success', action: 'merged' }
      }

      // Conflicts detected, return conflict for UI to handle
      logger.warn(`Conflicts detected: ${conflicts.length} conflicting fields`)

      return {
        status: 'unresolved',
        data: {
          base: lastSyncedConfigValueAndMeta.value,
          local: localConfigValueAndMeta.value,
          remote: remoteConfigValueAndMeta.value,
        },
      }
    }
    else if (localChangedSinceSync) {
      logger.info('Local config is newer, uploading local config')
      await uploadConfig(localConfigValueAndMeta)
      await updateLastSyncConfigAndMeta({
        value: localConfigValueAndMeta.value,
        meta: { ...localConfigValueAndMeta.meta, email, lastSyncedAt: Date.now() },
      })
      return { status: 'success', action: 'uploaded' }
    }
    else if (remoteChangedSinceSync) {
      logger.info('Remote config is newer, downloading remote config')
      await saveConfigValueAndMeta(remoteConfigValueAndMeta)
      await updateLastSyncConfigAndMeta({
        value: remoteConfigValueAndMeta.value,
        meta: { ...remoteConfigValueAndMeta.meta, email, lastSyncedAt: Date.now() },
      })
      return { status: 'success', action: 'downloaded' }
    }
    else {
      logger.info('No changes, skipping sync')
      await updateLastSyncConfigAndMeta({
        value: localConfigValueAndMeta.value,
        meta: { ...localConfigValueAndMeta.meta, email, lastSyncedAt: Date.now() },
      })
      return { status: 'success', action: 'no-change' }
    }
  }
  catch (error) {
    logger.error('Config sync failed', error)
    return {
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
