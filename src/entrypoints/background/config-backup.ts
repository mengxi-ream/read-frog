import type { Config } from "@/types/config/config"
import { browser, storage } from "#imports"
import { addBackup, isSameAsLatestBackup } from "@/utils/backup/storage"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { BACKUP_INTERVAL_MINUTES } from "@/utils/constants/backup"
import { CONFIG_SCHEMA_VERSION, CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("background/config-backup")

const CONFIG_BACKUP_ALARM = "config-backup"

export function setUpConfigBackup() {
  // Set up periodic alarm for config backup (only if it doesn't exist yet —
  // re-creating it on every service-worker start resets the timer, which
  // would wake the worker `delayInMinutes` later in a perpetual loop)
  void browser.alarms.get(CONFIG_BACKUP_ALARM).then((existingAlarm) => {
    if (!existingAlarm) {
      void browser.alarms.create(CONFIG_BACKUP_ALARM, {
        delayInMinutes: BACKUP_INTERVAL_MINUTES,
        periodInMinutes: BACKUP_INTERVAL_MINUTES,
      })
    }
  })

  // Listen for alarm events
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CONFIG_BACKUP_ALARM) {
      await performAutoBackup()
    }
  })

  log.info("Config auto-backup scheduled", { intervalMinutes: BACKUP_INTERVAL_MINUTES })
}

async function performAutoBackup() {
  try {
    // Get current config from storage
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)

    if (!config) {
      log.warn("No config found to backup")
      return
    }

    if (await isSameAsLatestBackup(config, CONFIG_SCHEMA_VERSION)) {
      log.debug("Skipping backup: config is identical to latest backup")
      return
    }

    // Add backup
    await addBackup(config, EXTENSION_VERSION)

    log.info("Auto backup completed successfully")
  } catch (error) {
    log.error("Failed to perform auto backup", { error })
  }
}
