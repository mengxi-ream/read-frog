import { browser } from '#imports'
import { db } from '@/utils/db/dexie/db'
import { logger } from '@/utils/logger'

export const CHECK_INTERVAL_MINUTES = 24 * 60

export const CACHE_CLEANUP_ALARM = 'cache-cleanup'
export const CACHE_MAX_AGE_MINUTES = 7 * 24 * 60

export const REQUEST_RECORD_CLEANUP_ALARM = 'request-record-cleanup'
export const REQUEST_RECORD_MAX_COUNT = 10000
export const REQUEST_RECORD_MAX_AGE_DAYS = 120

export async function setUpDatabaseCleanup() {
  // Set up periodic alarms (only if they don't exist)
  const existingCacheAlarm = await browser.alarms.get(CACHE_CLEANUP_ALARM)
  if (!existingCacheAlarm) {
    void browser.alarms.create(CACHE_CLEANUP_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    })
  }

  const existingRequestAlarm = await browser.alarms.get(REQUEST_RECORD_CLEANUP_ALARM)
  if (!existingRequestAlarm) {
    void browser.alarms.create(REQUEST_RECORD_CLEANUP_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    })
  }

  // Register the alarm listener
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CACHE_CLEANUP_ALARM) {
      await cleanupOldCache()
    }
    else if (alarm.name === REQUEST_RECORD_CLEANUP_ALARM) {
      await cleanupOldRequestRecords()
    }
  })

  // Run cleanup immediately when background script starts
  cleanupOldCache().catch((error) => {
    logger.error('Failed to run initial cache cleanup:', error)
  })

  cleanupOldRequestRecords().catch((error) => {
    logger.error('Failed to run initial request records cleanup:', error)
  })
}

async function cleanupOldCache() {
  try {
    const cutoffDate = new Date()
    cutoffDate.setTime(cutoffDate.getTime() - CACHE_MAX_AGE_MINUTES * 60 * 1000)

    // Delete all cache entries older than the cutoff date
    const deletedCount = await db.translationCache
      .where('createdAt')
      .below(cutoffDate)
      .delete()

    if (deletedCount > 0) {
      logger.info(`Cache cleanup: Deleted ${deletedCount} old translation cache entries`)
    }
  }
  catch (error) {
    logger.error('Failed to cleanup old cache:', error)
  }
}

export async function cleanupAllCache() {
  try {
    // Delete all translation cache entries
    await db.translationCache.clear()

    logger.info(`Cache cleanup: Deleted all translation cache entries`)
  }
  catch (error) {
    logger.error('Failed to cleanup all cache:', error)
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
        .orderBy('createdAt')
        .limit(excessCount)
        .toArray()

      const keysToDelete = oldestRecords.map(record => record.key)
      await db.batchRequestRecord.bulkDelete(keysToDelete)

      logger.info(`Request records cleanup: Deleted ${excessCount} oldest records (count exceeded ${REQUEST_RECORD_MAX_COUNT})`)
    }

    // Delete records older than max age
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - REQUEST_RECORD_MAX_AGE_DAYS)

    const deletedByAgeCount = await db.batchRequestRecord
      .where('createdAt')
      .below(cutoffDate)
      .delete()

    if (deletedByAgeCount > 0) {
      logger.info(`Request records cleanup: Deleted ${deletedByAgeCount} records older than ${REQUEST_RECORD_MAX_AGE_DAYS} days`)
    }
  }
  catch (error) {
    logger.error('Failed to cleanup old request records:', error)
  }
}

export async function cleanupAllRequestRecords() {
  try {
    // Delete all batch request records
    await db.batchRequestRecord.clear()

    logger.info(`Request records cleanup: Deleted all batch request records`)
  }
  catch (error) {
    logger.error('Failed to cleanup all request records:', error)
    throw error
  }
}
