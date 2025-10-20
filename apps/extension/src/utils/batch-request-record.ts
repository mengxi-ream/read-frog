import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { db } from '@/utils/db/dexie/db'
import { Sha256Hex } from '@/utils/hash'
import { getDateFromDaysBack } from '@/utils/utils'
import { logger } from './logger'

/**
 * Generate mock batch request records for testing
 * @param days Number of days to generate (default: 60)
 * @returns Array of mock BatchRequestRecord
 */
function generateMockBatchRequestRecords(days: number = 60): BatchRequestRecord[] {
  const records: BatchRequestRecord[] = []
  const now = new Date()

  const providers = [
    { key: 'a1b2c3d4e5f6', provider: 'openai', model: 'gpt-4' },
    { key: 'f6e5d4c3b2a1', provider: 'deepseek', model: 'deepseek-chat' },
    { key: 'b2c3d4e5f6a7', provider: 'google', model: 'gemini-pro' },
  ]

  // Generate records for each day
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)

    // Generate 2-4 records per day with some randomness
    const recordsPerDay = Math.floor(Math.random() * 3) + 2

    for (let j = 0; j < recordsPerDay; j++) {
      const provider = providers[Math.floor(Math.random() * providers.length)]
      const hour = Math.floor(Math.random() * 12) + 8 // 8-20
      const minute = Math.floor(Math.random() * 60)

      const recordDate = new Date(date)
      recordDate.setHours(hour, minute, 0, 0)

      // Generate request count with trend: gradually increasing over time
      const randomness = Math.floor(Math.random() * 10)
      const originalRequestCount = randomness

      records.push({
        key: provider.key,
        createdAt: recordDate,
        originalRequestCount,
        provider: provider.provider,
        model: provider.model,
      } as BatchRequestRecord)
    }
  }

  return records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

const allMockRecords = generateMockBatchRequestRecords(60)

export async function getRangeBatchRequestRecords(startDay: string | number, endDay?: string | number) {
  const startDate = getDateFromDaysBack(Number(startDay))
  const endDate = getDateFromDaysBack(Number(endDay ?? 0))

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  // return await db.batchRequestRecord
  //   .where('createdAt')
  //   .between(startDate, endDate)
  //   .toArray()

  return allMockRecords.filter(record => record.createdAt >= startDate && record.createdAt <= endDate)
}

export async function putBatchRequestRecord(
  { originalRequestCount, provider, model }:
  { originalRequestCount: number, provider: string, model: string },
) {
  try {
    await db.batchRequestRecord.put({
      key: Sha256Hex(`${provider}-${model}`),
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
