import { atom } from 'jotai'
import { unwrap } from 'jotai/utils'
import { getRangeBatchRequestRecords } from '@/utils/batch-request-record'

const DEFAULT_RECENT_DAY = '5'

export const recentDayAtom = atom<string>(DEFAULT_RECENT_DAY)

/**
 * Get batch request records for the current period
 *
 * Note: We subtract 1 from recentDay because:
 * - recentDay represents "the last N days" (e.g., 7 means "last 7 days")
 * - "Last 7 days" means: today + past 6 days = 7 days total
 * - getRangeBatchRequestRecords(daysBack) gets records from "daysBack days ago" to "today"
 * - If we pass 7, it would get from "7 days ago" to "today" = 8 days
 * - So we pass (recentDay - 1) = 6 to get exactly 7 days of data
 *
 * Example: recentDay = 7
 * - daysBack = 6
 * - Range: 6 days ago → today (7 days total) ✓
 */
export const currentPeriodBatchRequestRecordsAsyncAtom = atom(async (get) => {
  const daysBack = Number(get(recentDayAtom)) - 1
  return await getRangeBatchRequestRecords(daysBack)
})

/**
 * Get batch request records for the previous period (for comparison)
 *
 * Continues the logic from currentPeriod:
 * - daysBack = recentDay - 1 (same as current period)
 * - Previous period should cover the same duration, but shifted backwards
 * - Start: (daysBack * 2 + 1) days ago
 * - End: (daysBack + 1) days ago
 *
 * Example: recentDay = 7
 * - daysBack = 6
 * - Start: 6 * 2 + 1 = 13 days ago
 * - End: 6 + 1 = 7 days ago
 * - Range: 13 days ago → 7 days ago (7 days total) ✓
 * - This gives us the comparable previous period
 */
export const previousPeriodBatchRequestRecordsAsyncAtom = atom(async (get) => {
  const daysBack = Number(get(recentDayAtom)) - 1
  return await getRangeBatchRequestRecords(daysBack * 2 + 1, daysBack + 1)
})

export const currentPeriodBatchRequestRecordsAtom = unwrap(currentPeriodBatchRequestRecordsAsyncAtom, prev => prev ?? [])
export const previousPeriodBatchRequestRecordsAtom = unwrap(previousPeriodBatchRequestRecordsAsyncAtom, prev => prev ?? [])
