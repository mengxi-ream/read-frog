import type { Table } from "dexie"
import { browser } from "#imports"
import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"

export const CHECK_INTERVAL_MINUTES = 24 * 60

export const TRANSLATION_CACHE_CLEANUP_ALARM = "cache-cleanup"
export const TRANSLATION_CACHE_MAX_AGE_MINUTES = 7 * 24 * 60

export const REQUEST_RECORD_CLEANUP_ALARM = "request-record-cleanup"
export const REQUEST_RECORD_MAX_COUNT = 10000
export const REQUEST_RECORD_MAX_AGE_DAYS = 120

export const SUMMARY_CACHE_CLEANUP_ALARM = "summary-cache-cleanup"
export const SUMMARY_CACHE_MAX_AGE_MINUTES = 7 * 24 * 60

export const AI_SEGMENTATION_CACHE_CLEANUP_ALARM = "ai-segmentation-cache-cleanup"
export const AI_SEGMENTATION_CACHE_MAX_AGE_MINUTES = 7 * 24 * 60

export async function setUpDatabaseCleanup() {
  const cleanupJobs = new Map<string, () => Promise<void>>([
    [
      TRANSLATION_CACHE_CLEANUP_ALARM,
      createCacheCleanup({
        table: db.translationCache,
        maxAgeMinutes: TRANSLATION_CACHE_MAX_AGE_MINUTES,
        label: "Translation cache",
      }),
    ],
    [REQUEST_RECORD_CLEANUP_ALARM, cleanupOldRequestRecords],
    [
      SUMMARY_CACHE_CLEANUP_ALARM,
      createCacheCleanup({
        table: db.articleSummaryCache,
        maxAgeMinutes: SUMMARY_CACHE_MAX_AGE_MINUTES,
        label: "Summary cache",
      }),
    ],
    [
      AI_SEGMENTATION_CACHE_CLEANUP_ALARM,
      createCacheCleanup({
        table: db.aiSegmentationCache,
        maxAgeMinutes: AI_SEGMENTATION_CACHE_MAX_AGE_MINUTES,
        label: "AI segmentation cache",
      }),
    ],
  ])

  // Register synchronously so alarms can wake the background during initialization.
  browser.alarms.onAlarm.addListener(async (alarm) => {
    await cleanupJobs.get(alarm.name)?.()
  })

  for (const name of cleanupJobs.keys()) {
    if (!(await browser.alarms.get(name))) {
      void browser.alarms.create(name, {
        delayInMinutes: 1,
        periodInMinutes: CHECK_INTERVAL_MINUTES,
      })
    }
  }
}

function createCacheCleanup({
  table,
  maxAgeMinutes,
  label,
}: {
  table: Pick<Table<{ createdAt: Date }>, "where">
  maxAgeMinutes: number
  label: string
}) {
  return async () => {
    try {
      const cutoffDate = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
      const deletedCount = await table.where("createdAt").below(cutoffDate).delete()

      if (deletedCount > 0) {
        logger.info(`${label} cleanup: Deleted ${deletedCount} old entries`)
      }
    } catch (error) {
      logger.error(`Failed to cleanup old ${label}:`, error)
    }
  }
}

export async function cleanupAllTranslationCache() {
  try {
    // Delete all translation cache entries
    await db.translationCache.clear()

    logger.info(`Cache cleanup: Deleted all translation cache entries`)
  } catch (error) {
    logger.error("Failed to cleanup all cache:", error)
    throw error
  }
}

async function cleanupOldRequestRecords() {
  try {
    const totalCount = await db.batchRequestRecord.count()

    // Check if count exceeds maximum
    if (totalCount > REQUEST_RECORD_MAX_COUNT) {
      const excessCount = totalCount - REQUEST_RECORD_MAX_COUNT

      // Delete oldest records to bring count back to maximum
      const oldestRecords = await db.batchRequestRecord
        .orderBy("createdAt")
        .limit(excessCount)
        .toArray()

      const keysToDelete = oldestRecords.map((record) => record.key)
      await db.batchRequestRecord.bulkDelete(keysToDelete)

      logger.info(
        `Request records cleanup: Deleted ${excessCount} oldest records (count exceeded ${REQUEST_RECORD_MAX_COUNT})`,
      )
    }

    // Delete records older than max age
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - REQUEST_RECORD_MAX_AGE_DAYS)

    const deletedByAgeCount = await db.batchRequestRecord
      .where("createdAt")
      .below(cutoffDate)
      .delete()

    if (deletedByAgeCount > 0) {
      logger.info(
        `Request records cleanup: Deleted ${deletedByAgeCount} records older than ${REQUEST_RECORD_MAX_AGE_DAYS} days`,
      )
    }
  } catch (error) {
    logger.error("Failed to cleanup old request records:", error)
  }
}

export async function cleanupAllRequestRecords() {
  try {
    // Delete all batch request records
    await db.batchRequestRecord.clear()

    logger.info(`Request records cleanup: Deleted all batch request records`)
  } catch (error) {
    logger.error("Failed to cleanup all request records:", error)
    throw error
  }
}

export async function cleanupAllSummaryCache() {
  try {
    // Delete all article summary cache entries
    await db.articleSummaryCache.clear()

    logger.info(`Summary cache cleanup: Deleted all article summary cache entries`)
  } catch (error) {
    logger.error("Failed to cleanup all summary cache:", error)
    throw error
  }
}

export async function cleanupAllAiSegmentationCache() {
  try {
    await db.aiSegmentationCache.clear()
    logger.info("AI segmentation cache cleanup: Deleted all entries")
  } catch (error) {
    logger.error("Failed to cleanup all AI segmentation cache:", error)
    throw error
  }
}
