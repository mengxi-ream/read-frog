import { db } from "@/utils/db/dexie/db"
import { generateMockBatchRequestRecords } from "@/utils/db/dexie/mock-data"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("background/mock-data")

/**
 * Initialize mock data for development
 * Only runs when WXT_MOCK_DATA=true is set in environment variables
 */
export async function initMockData() {
  if (import.meta.env.DEV && import.meta.env.WXT_MOCK_DATA === "true") {
    const existingCount = await db.batchRequestRecord.count()
    if (existingCount > 0) {
      log.debug("Skipping mock data: records already exist", { existingCount })
      return
    }

    log.debug("Initializing mock batch request records...")
    generateMockBatchRequestRecords()
      .then(() => {
        log.debug("Mock data generation completed")
      })
      .catch((error) => {
        log.error("Failed to generate mock data", { error })
      })
  }
}
