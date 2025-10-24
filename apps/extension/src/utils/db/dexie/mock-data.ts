import { faker } from '@faker-js/faker'
import { LLM_PROVIDER_TYPES, TRANSLATE_PROVIDER_MODELS } from '@/types/config/provider'
import { logger } from '@/utils/logger'
import { db } from './db'

export async function generateMockBatchRequestRecords(count = 10000, daysBack = 180) {
  const records = Array.from({ length: count }, () => {
    const provider = faker.helpers.arrayElement(LLM_PROVIDER_TYPES)
    const models = TRANSLATE_PROVIDER_MODELS[provider]

    return {
      key: faker.string.uuid(),
      createdAt: faker.date.recent({ days: daysBack }),
      originalRequestCount: faker.number.int({ min: 1, max: 8 }),
      provider,
      model: faker.helpers.arrayElement(models),
    }
  })

  await db.batchRequestRecord.bulkAdd(records)
  logger.info(`✅ Generated ${count} mock batch request records`)
}

/**
 * Clear all batch request records from the database
 */
export async function clearMockData() {
  await db.batchRequestRecord.clear()
  logger.info('🗑️  Cleared all batch request records')
}
