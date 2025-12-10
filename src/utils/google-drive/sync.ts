import type { UnresolvedConfigs } from '../atoms/google-drive-sync'
import type { Config } from '@/types/config/config'
import { dequal } from 'dequal'
import { configSchema } from '@/types/config/config'
import {
  getLastSyncedConfigAndMeta,
  getLocalConfigAndMeta,
  getRemoteConfigAndMetaWithUserEmail,
  setLastSyncConfigAndMeta,
  setLocalConfigAndMeta,
  setRemoteConfigAndMeta,
} from '../config/storage'
import { CONFIG_SCHEMA_VERSION } from '../constants/config'
import { logger } from '../logger'

export type SyncAction = 'uploaded' | 'downloaded' | 'same-changes' | 'no-change'

export type SyncResult
  = | { status: 'success', action: SyncAction }
    | { status: 'unresolved', data: UnresolvedConfigs }
    | { status: 'error', error: Error }

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
    await setLocalConfigAndMeta(validatedConfig, { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now })

    // Upload to Google Drive
    await setRemoteConfigAndMeta({
      value: validatedConfig,
      meta: { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now },
    })

    // Update sync metadata
    await setLastSyncConfigAndMeta(
      validatedConfig,
      { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now, email },
    )

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

    const now = Date.now()

    if (email !== lastSyncedConfigValueAndMeta?.meta.email) {
      if (remoteConfigValueAndMeta) {
        logger.info('Remote config found, saving remote config')
        await setLocalConfigAndMeta(remoteConfigValueAndMeta.value, remoteConfigValueAndMeta.meta)
        await setLastSyncConfigAndMeta(
          remoteConfigValueAndMeta.value,
          { ...remoteConfigValueAndMeta.meta, email, lastSyncedAt: now },
        )
        return { status: 'success', action: 'downloaded' }
      }
      else {
        logger.info('No remote config found, uploading local config')
        await setRemoteConfigAndMeta(localConfigValueAndMeta)
        await setLastSyncConfigAndMeta(
          localConfigValueAndMeta.value,
          { ...localConfigValueAndMeta.meta, email, lastSyncedAt: now },
        )
        return { status: 'success', action: 'uploaded' }
      }
    }

    // Check if both local and remote changed since last sync
    const localChangedSinceSync = localConfigValueAndMeta.meta.lastModifiedAt > lastSyncedConfigValueAndMeta.meta.lastModifiedAt
    const remoteChangedSinceSync = remoteConfigValueAndMeta && remoteConfigValueAndMeta.meta.lastModifiedAt > lastSyncedConfigValueAndMeta.meta.lastModifiedAt

    if (localChangedSinceSync && remoteChangedSinceSync) {
      logger.info('Both local and remote changed since last sync, checking for conflicts')

      const sameLocalAndRemote = dequal(localConfigValueAndMeta.value, remoteConfigValueAndMeta.value)

      if (sameLocalAndRemote) {
        logger.info('Local and remote configurations are the same, no conflicts detected')
        const now = Date.now()

        // if the schemaVersion is different, use local config's schemaVersion
        const mergedConfigValueAndMeta = {
          value: localConfigValueAndMeta.value,
          meta: { schemaVersion: CONFIG_SCHEMA_VERSION, lastModifiedAt: now },
        }

        await setLocalConfigAndMeta(mergedConfigValueAndMeta.value, mergedConfigValueAndMeta.meta)
        await setRemoteConfigAndMeta(mergedConfigValueAndMeta)
        await setLastSyncConfigAndMeta(
          mergedConfigValueAndMeta.value,
          { ...mergedConfigValueAndMeta.meta, email, lastSyncedAt: now },
        )

        return { status: 'success', action: 'same-changes' }
      }

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
      await setRemoteConfigAndMeta(localConfigValueAndMeta)
      await setLastSyncConfigAndMeta(
        localConfigValueAndMeta.value,
        { ...localConfigValueAndMeta.meta, email, lastSyncedAt: now },
      )
      return { status: 'success', action: 'uploaded' }
    }
    else if (remoteChangedSinceSync) {
      logger.info('Remote config is newer, downloading remote config')
      await setLocalConfigAndMeta(remoteConfigValueAndMeta.value, remoteConfigValueAndMeta.meta)
      await setLastSyncConfigAndMeta(
        remoteConfigValueAndMeta.value,
        { ...remoteConfigValueAndMeta.meta, email, lastSyncedAt: now },
      )
      return { status: 'success', action: 'downloaded' }
    }
    else {
      logger.info('No changes, skipping sync')
      await setLastSyncConfigAndMeta(
        localConfigValueAndMeta.value,
        { ...localConfigValueAndMeta.meta, email, lastSyncedAt: now },
      )
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
