import { db } from '@/utils/db/dexie/db'
import { logger } from './logger'

export async function getBatchRequestTimes(timeRange: string) {
  return await db.batchRequestTimes
    .where('createdAt')
    .above(new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000))
    .toArray()
}

export async function putBatchRequestTimes(originalRequestCount: number, provider: string, model: string) {
  try {
    await db.batchRequestTimes.put({
      key: `${provider}-${model}`,
      createdAt: new Date(),
      originalRequestCount,
      provider,
      model,
    })
  }
  catch (error) {
    logger.error(error)
  }
}
