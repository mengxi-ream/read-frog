import { storage } from "#imports";
import { LAST_SYNCED_CONFIG_STORAGE_KEY } from "../constants/config";
import { logger } from "../logger";
import { migrateConfig } from "./migration";
export async function getLastSyncedConfigAndMeta() {
    const [rawValue, meta] = await Promise.all([
        storage.getItem(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`),
        storage.getMeta(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`),
    ]);
    if (!rawValue || !meta) {
        return null;
    }
    try {
        const value = await migrateConfig(rawValue, meta.schemaVersion);
        return { value, meta };
    }
    catch (error) {
        logger.error("Failed to migrate last synced config", error);
        return null;
    }
}
export async function setLastSyncConfigAndMeta(value, meta) {
    const lastSyncedAt = meta.lastSyncedAt ?? Date.now();
    await Promise.all([
        storage.setItem(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, value),
        storage.setMeta(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`, {
            ...meta,
            lastSyncedAt,
        }),
    ]);
}
