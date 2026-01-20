import { browser } from '#imports'
import { db } from '@/utils/db/dexie/db'
import { logger } from '@/utils/logger'

export const CHECK_INTERVAL_MINUTES = 24 * 60

export const TRANSLATION_CACHE_CLEANUP_ALARM = 'cache-cleanup'
export const TRANSLATION_CACHE_MAX_AGE_MINUTES = 7 * 24 * 60

export const REQUEST_RECORD_CLEANUP_ALARM = 'request-record-cleanup'
export const REQUEST_RECORD_MAX_COUNT = 10000
export const REQUEST_RECORD_MAX_AGE_DAYS = 120

export const SUMMARY_CACHE_CLEANUP_ALARM = 'summary-cache-cleanup'
export const SUMMARY_CACHE_MAX_AGE_MINUTES = 7 * 24 * 60

export async function setUpDatabaseCleanup() {
  // Set up periodic alarms (only if they don't exist)
  const existingCacheAlarm = await browser.alarms.get(TRANSLATION_CACHE_CLEANUP_ALARM)
  if (!existingCacheAlarm) {
    void browser.alarms.create(TRANSLATION_CACHE_CLEANUP_ALARM, {
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

  const existingSummaryAlarm = await browser.alarms.get(SUMMARY_CACHE_CLEANUP_ALARM)
  if (!existingSummaryAlarm) {
    void browser.alarms.create(SUMMARY_CACHE_CLEANUP_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    })
  }

  // Register the alarm listener
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TRANSLATION_CACHE_CLEANUP_ALARM) {
      await cleanupOldTranslationCache()
    }
    else if (alarm.name === REQUEST_RECORD_CLEANUP_ALARM) {
      await cleanupOldRequestRecords()
    }
    else if (alarm.name === SUMMARY_CACHE_CLEANUP_ALARM) {
      await cleanupOldSummaryCache()
    }
  })

  // Run cleanup immediately when background script starts
  cleanupOldTranslationCache().catch((error) => {
    logger.error('Failed to run initial cache cleanup:', error)
  })

  cleanupOldRequestRecords().catch((error) => {
    logger.error('Failed to run initial request records cleanup:', error)
  })

  cleanupOldSummaryCache().catch((error) => {
    logger.error('Failed to run initial summary cache cleanup:', error)
  })
}

async function cleanupOldTranslationCache() {
  try {
    const cutoffDate = new Date()
    cutoffDate.setTime(cutoffDate.getTime() - TRANSLATION_CACHE_MAX_AGE_MINUTES * 60 * 1000)

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

export async function cleanupAllTranslationCache() {
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

async function cleanupOldSummaryCache() {
  try {
    const cutoffDate = new Date()
    cutoffDate.setTime(cutoffDate.getTime() - SUMMARY_CACHE_MAX_AGE_MINUTES * 60 * 1000)

    // Delete all summary cache entries older than the cutoff date
    const deletedCount = await db.articleSummaryCache
      .where('createdAt')
      .below(cutoffDate)
      .delete()

    if (deletedCount > 0) {
      logger.info(`Summary cache cleanup: Deleted ${deletedCount} old article summary cache entries`)
    }
  }
  catch (error) {
    logger.error('Failed to cleanup old summary cache:', error)
  }
}

export async function cleanupAllSummaryCache() {
  try {
    // Delete all article summary cache entries
    await db.articleSummaryCache.clear()

    logger.info(`Summary cache cleanup: Deleted all article summary cache entries`)
  }
  catch (error) {
    logger.error('Failed to cleanup all summary cache:', error)
    throw error
  }
}

export async function cleanupAllAiSegmentationCache() {
  try {
    await db.aiSegmentationCache.clear()
    logger.info('AI segmentation cache cleanup: Deleted all entries')
  }
  catch (error) {
    logger.error('Failed to cleanup all AI segmentation cache:', error)
    throw error
  }
}
