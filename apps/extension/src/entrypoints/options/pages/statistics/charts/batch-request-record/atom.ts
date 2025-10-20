import { atom } from 'jotai'
import { unwrap } from 'jotai/utils'
import { getRangeBatchRequestRecords } from '@/utils/batch-request-record'

const DEFAULT_RECENT_DAY = '5'

export const recentDayAtom = atom<string>(DEFAULT_RECENT_DAY)

export const currentPeriodBatchRequestRecordsAsyncAtom = atom(async (get) => {
  const recentDay = Number(get(recentDayAtom))
  return await getRangeBatchRequestRecords(recentDay)
})

export const previousPeriodBatchRequestRecordsAsyncAtom = atom(async (get) => {
  const recentDay = Number(get(recentDayAtom))
  return await getRangeBatchRequestRecords(recentDay * 2, recentDay)
})

export const currentPeriodBatchRequestRecordsAtom = unwrap(currentPeriodBatchRequestRecordsAsyncAtom, prev => prev ?? [])
export const previousPeriodBatchRequestRecordsAtom = unwrap(previousPeriodBatchRequestRecordsAsyncAtom, prev => prev ?? [])
