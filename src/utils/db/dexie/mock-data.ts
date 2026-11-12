import { faker } from "@faker-js/faker"
import {
  REQUEST_RECORD_MAX_AGE_DAYS,
  REQUEST_RECORD_MAX_COUNT,
} from "@/entrypoints/background/db-cleanup"
import { LLM_PROVIDER_MODELS, LLM_PROVIDER_TYPES } from "@/types/config/provider"
import { createLogger } from "@/utils/logging/logger"
import { db } from "./db"

const log = createLogger("db/dexie/mock-data")

export async function generateMockBatchRequestRecords(
  count = REQUEST_RECORD_MAX_COUNT,
  daysBack = REQUEST_RECORD_MAX_AGE_DAYS,
) {
  const records = Array.from({ length: count }, () => {
    const provider = faker.helpers.arrayElement(LLM_PROVIDER_TYPES)
    const models = LLM_PROVIDER_MODELS[provider]

    return {
      key: faker.string.uuid(),
      createdAt: faker.date.recent({ days: daysBack }),
      originalRequestCount: faker.number.int({ min: 1, max: 8 }),
      provider,
      model: faker.helpers.arrayElement(models),
    }
  })

  await db.batchRequestRecord.bulkAdd(records)
  log.debug("Generated mock batch request records", { count })
}

/**
 * Clear all batch request records from the database
 */
export async function clearMockData() {
  await db.batchRequestRecord.clear()
  log.debug("🗑️  Cleared all batch request records")
}
