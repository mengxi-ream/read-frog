import type { ProviderConfig } from '@/types/config/provider'
import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { isLLMProviderConfig } from '@/types/config/provider'
import { db } from '@/utils/db/dexie/db'
import { getDateFromDaysBack, numberToPercentage } from '@/utils/utils'
import { logger } from './logger'

export async function getRangeBatchRequestRecords(startDay: number, endDay?: number) {
  const startDate = getDateFromDaysBack(startDay)
  const endDate = getDateFromDaysBack(endDay ?? 0)

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  return await db.batchRequestRecord
    .where('createdAt')
    .between(startDate, endDate)
    .toArray()
}

export async function putBatchRequestRecord(
  { originalRequestCount, providerConfig }:
  { originalRequestCount: number, providerConfig: ProviderConfig },
) {
  if (!isLLMProviderConfig(providerConfig))
    return

  const { provider, model: providerModel } = providerConfig
  const modelName = providerModel.isCustomModel ? providerModel.customModel : providerModel.model

  try {
    await db.batchRequestRecord.put({
      key: crypto.randomUUID(),
      createdAt: new Date(),
      originalRequestCount,
      provider,
      model: modelName ?? '',
    })
  }
  catch (error) {
    logger.error('Failed to put batch request record', error)
  }
}

export function calculateAverageSavePercentage(batchRequestRecords: BatchRequestRecord[]): string {
  if (!batchRequestRecords.length)
    return '0%'

  const originalRequestCount = batchRequestRecords.reduce((acc, record) => acc + record.originalRequestCount, 0)
  const batchRequestCount = batchRequestRecords.length

  const averageSavePercent = (originalRequestCount - batchRequestCount) / originalRequestCount
  return numberToPercentage(averageSavePercent)
}
