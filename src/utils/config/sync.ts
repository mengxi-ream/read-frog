import type { LastSyncedConfigMeta, LastSyncedConfigValueAndMeta } from "@/types/config/meta"
import { storage } from "#imports"
import { LAST_SYNCED_CONFIG_STORAGE_KEY } from "../constants/config"
import { logger } from "../logger"
import { migrateConfig } from "./migration"

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
    logger.error("Failed to migrate last synced config", error)
    return null
  }
}
