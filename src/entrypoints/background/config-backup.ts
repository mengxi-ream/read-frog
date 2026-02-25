import type { Config } from "@/types/config/config"
import { browser, storage } from "#imports"
import { addBackup, isSameAsLatestBackup } from "@/utils/backup/storage"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { BACKUP_INTERVAL_MINUTES } from "@/utils/constants/backup"
import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { logger } from "@/utils/logger"

const CONFIG_BACKUP_ALARM = "config-backup"

export function setUpConfigBackup() {
  // Set up periodic alarm for config backup
  void browser.alarms.create(CONFIG_BACKUP_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: BACKUP_INTERVAL_MINUTES,
  })

  // Listen for alarm events
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CONFIG_BACKUP_ALARM) {
      await performAutoBackup()
    }
  })

  logger.info("Config auto-backup scheduled every", BACKUP_INTERVAL_MINUTES, "minutes")
}

async function performAutoBackup() {
  try {
    // Get current config from storage
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)

    if (!config) {
      logger.warn("No config found to backup")
      return
    }

    if (await isSameAsLatestBackup(config, CONFIG_SCHEMA_VERSION)) {
      logger.info("Skipping backup: config is identical to latest backup")
      return
    }

    // Add backup
    await addBackup(config, EXTENSION_VERSION)

    logger.info("Auto backup completed successfully")
  }
  catch (error) {
    logger.error("Failed to perform auto backup:", error)
  }
}
