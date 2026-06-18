import { dequal } from "dequal";
import { storage } from "#imports";
import { BACKUP_ID_PREFIX, MAX_BACKUPS_COUNT } from "@/utils/constants/backup";
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config";
import { getRandomUUID } from "@/utils/crypto-polyfill";
import { logger } from "@/utils/logger";
/**
 * Generate a unique ID for a backup based on timestamp
 */
function generateBackupId(timestamp) {
    const uuid = getRandomUUID();
    return `${BACKUP_ID_PREFIX}_${timestamp}_${uuid}`;
}
/**
 * Get all backups sorted by timestamp (newest first)
 */
export async function getAllBackupsWithMetadata() {
    const backupIds = await storage.getItem("local:backup_ids") ?? [];
    const backups = [];
    for (const id of backupIds) {
        const backup = await storage.getItem(`local:${id}`);
        const metadata = await storage.getMeta(`local:${id}`);
        if (backup && metadata) {
            backups.push({ ...backup, metadata, id });
        }
    }
    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
}
/**
 * Check if config is the same as the latest backup
 */
export async function isSameAsLatestBackup(config, configSchemaVersion) {
    const backupsWithMetadata = await getAllBackupsWithMetadata();
    if (backupsWithMetadata.length === 0) {
        return false;
    }
    const latestBackupWithMetadata = backupsWithMetadata[0];
    // Compare schema version
    if (latestBackupWithMetadata.schemaVersion !== configSchemaVersion) {
        return false;
    }
    return dequal(latestBackupWithMetadata.config, config);
}
/**
 * Add a new backup to storage
 * Automatically removes oldest backup if limit is exceeded
 * Skips backup if config is identical to the latest backup
 */
export async function addBackup(config, extensionVersion) {
    try {
        const timestamp = Date.now();
        const backupId = generateBackupId(timestamp);
        const backup = {
            schemaVersion: CONFIG_SCHEMA_VERSION,
            config,
        };
        // Get current backup IDs
        const backupIds = await storage.getItem("local:backup_ids") ?? [];
        // Add new backup ID to the beginning
        backupIds.unshift(backupId);
        // If we exceed max backups, remove the oldest ones
        if (backupIds.length > MAX_BACKUPS_COUNT) {
            const removedIds = backupIds.splice(MAX_BACKUPS_COUNT);
            // Remove the old backup items from storage
            await storage.removeItems(removedIds.map(id => ({ key: `local:${id}`, options: { removeMeta: true } })));
        }
        // Save the backup with metadata
        await storage.setItem(`local:${backupId}`, backup);
        await storage.setMeta(`local:${backupId}`, { createdAt: timestamp, extensionVersion });
        // Update backup IDs list
        await storage.setItem("local:backup_ids", backupIds);
        logger.info("Backup created:", backupId);
    }
    catch (error) {
        logger.error("Error adding backup:", error);
        throw error;
    }
}
/**
 * Remove a specific backup by timestamp
 */
export async function removeBackup(backupId) {
    try {
        const backupIds = await storage.getItem("local:backup_ids") ?? [];
        const updatedIds = backupIds.filter((id) => id !== backupId);
        await storage.setItem("local:backup_ids", updatedIds);
        await storage.removeItem(`local:${backupId}`, { removeMeta: true });
        logger.info("Backup removed:", backupId);
    }
    catch (error) {
        logger.error("Error removing backup:", error);
        throw error;
    }
}
/**
 * Clear all backups
 */
export async function clearAllBackups() {
    try {
        const backupIds = await storage.getItem("local:backup_ids") ?? [];
        // Remove all backup items
        await storage.removeItems(backupIds.map(id => ({ key: `local:${id}`, options: { removeMeta: true } })));
        // Clear backup IDs list
        await storage.removeItem("local:backup_ids");
        logger.info("All backups cleared");
    }
    catch (error) {
        logger.error("Error clearing backups:", error);
        throw error;
    }
}
