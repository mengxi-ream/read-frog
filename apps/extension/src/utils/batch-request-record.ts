import type { ProviderConfig } from '@/types/config/provider'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { db } from '@/utils/db/dexie/db'
import { getDateFromDaysBack } from '@/utils/utils'
import { logger } from './logger'

export async function getRangeBatchRequestRecords(startDay: string | number, endDay?: string | number) {
  const startDate = getDateFromDaysBack(Number(startDay))
  const endDate = getDateFromDaysBack(Number(endDay ?? 0))

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
  if (!isLLMTranslateProviderConfig(providerConfig))
    return

  const { provider, models: { translate } } = providerConfig
  const translateModel = translate.isCustomModel ? translate.customModel : translate.model

  try {
    await db.batchRequestRecord.put({
      key: crypto.randomUUID(),
      createdAt: new Date(),
      originalRequestCount,
      provider,
      model: translateModel ?? '',
    })
  }
  catch (error) {
    logger.error('Failed to put batch request record', error)
  }
}
