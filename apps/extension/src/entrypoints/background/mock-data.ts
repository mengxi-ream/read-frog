import { db } from '@/utils/db/dexie/db'
import { generateMockBatchRequestRecords } from '@/utils/db/dexie/mock-data'
import { logger } from '@/utils/logger'

/**
 * Initialize mock data for development
 * Only runs when WXT_MOCK_DATA=true is set in environment variables
 */
export async function initMockData() {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (import.meta.env.DEV && import.meta.env.WXT_MOCK_DATA === 'true') {
    const existingCount = await db.batchRequestRecord.count()
    if (existingCount > 0) {
      logger.info(`[Mock Data] Skipping initialization - ${existingCount} records already exist`)
      return
    }

    logger.info('[Mock Data] Initializing mock batch request records...')
    generateMockBatchRequestRecords()
      .then(() => {
        logger.info('[Mock Data] Mock data generation completed')
      })
      .catch((error) => {
        logger.error('[Mock Data] Failed to generate mock data:', error)
      })
  }
}
