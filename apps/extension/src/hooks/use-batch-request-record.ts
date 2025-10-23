import { useQueries } from '@tanstack/react-query'
import { getRangeBatchRequestRecords } from '@/utils/batch-request-record'

const RECENT_DAYS = [5, 7, 30, 60] as const

function previousPeriodStartDay(daysBack: number) {
  // For example, the previous period for 4 days ago is from 9 days ago to 5 days ago
  // i.e., 9 - 5 + 1 = 5 days
  return daysBack * 2 + 1
}

function previousPeriodEndDay(daysBack: number) {
  // The end date of the previous period needs to be earlier than the start date of the current period
  return daysBack + 1
}

export function useBatchRequestRecords(currentDaysBack: number) {
  const currentPeriodQueries = useQueries({
    queries: RECENT_DAYS.map((dayRange) => {
      // dayRange is a period that includes today, so after conversion it represents (dayRange - 1) days ago
      // i.e., a period of 5 days represents 4 days ago
      // The default end date is 0 days ago
      const daysBack = dayRange - 1
      return {
        queryKey: ['current-period-records', daysBack],
        queryFn: () => getRangeBatchRequestRecords(daysBack),
      }
    }),
  })

  const previousPeriodQueries = useQueries({
    queries: RECENT_DAYS.map((dayRange) => {
      const daysBack = dayRange - 1
      return {
        queryKey: ['previous-period-records', daysBack],
        queryFn: () => getRangeBatchRequestRecords(
          previousPeriodStartDay(daysBack),
          previousPeriodEndDay(daysBack),
        ),
      }
    }),
  })

  const currentIndex = RECENT_DAYS.findIndex(days => days - 1 === currentDaysBack)
  const currentPeriodQuery = currentPeriodQueries[currentIndex] ?? currentPeriodQueries[0]
  const previousPeriodQuery = previousPeriodQueries[currentIndex] ?? previousPeriodQueries[0]

  return {
    currentPeriodRecords: currentPeriodQuery.data ?? [],
    previousPeriodRecords: previousPeriodQuery.data ?? [],
    isLoading: currentPeriodQuery.isLoading || previousPeriodQuery.isLoading,
  }
}
