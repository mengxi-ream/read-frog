import { useQueries } from '@tanstack/react-query'
import { getRangeBatchRequestRecords } from '@/utils/batch-request-record'

const RECENT_DAYS = [5, 7, 30, 60] as const

export function useBatchRequestRecords(currentDaysBack: number) {
  const currentPeriodQueries = useQueries({
    queries: RECENT_DAYS.map((days) => {
      const daysBack = days - 1
      return {
        queryKey: ['current-period-records', daysBack],
        queryFn: () => getRangeBatchRequestRecords(daysBack + 1),
      }
    }),
  })

  const previousPeriodQueries = useQueries({
    queries: RECENT_DAYS.map((days) => {
      const daysBack = days - 1
      return {
        queryKey: ['previous-period-records', daysBack],
        queryFn: () => getRangeBatchRequestRecords(daysBack * 2 + 1, daysBack + 1),
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
