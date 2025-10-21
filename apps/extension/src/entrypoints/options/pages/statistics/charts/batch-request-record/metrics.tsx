import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import { MetricCard } from '@/entrypoints/options/components/metric-card'
import { currentPeriodBatchRequestRecordsAtom, previousPeriodBatchRequestRecordsAtom } from './atom'

export default function Metrics() {
  const currentPeriodRecords = useAtomValue(currentPeriodBatchRequestRecordsAtom)
  const previousPeriodRecords = useAtomValue(previousPeriodBatchRequestRecordsAtom)

  const metrics = transformRecordsToMetrics(currentPeriodRecords, previousPeriodRecords)

  return (
    <header className="h-fit w-full grid gap-4 grid-cols-2 grid-rows-1 xl:grid-cols-4">
      { Object.entries(metrics).map(([key, metric]) => <MetricCard key={key} {...metric} />) }
    </header>
  )
}

function transformRecordsToMetrics(currentPeriodRecords: BatchRequestRecord[], previousPeriodRecords: BatchRequestRecord[]) {
  const originalRequestCount = currentPeriodRecords.reduce((acc, record) => acc + record.originalRequestCount, 0)
  const batchRequestCount = currentPeriodRecords.length

  const previousOriginalRequestCount = previousPeriodRecords.reduce((acc, record) => acc + record.originalRequestCount, 0)
  const previousBatchRequestCount = previousPeriodRecords.length

  const originalRequestComparison = calculateComparison(originalRequestCount, previousOriginalRequestCount)
  const batchRequestComparison = calculateComparison(batchRequestCount, previousBatchRequestCount)

  return {
    originalRequestCount: {
      title: i18n.t('options.statistics.batchRequest.originalRequestCount'),
      metric: originalRequestCount,
      comparison: originalRequestComparison,
      icon: 'tabler:circle-filled',
    },
    batchRequestCount: {
      title: i18n.t('options.statistics.batchRequest.batchRequestCount'),
      metric: batchRequestCount,
      comparison: batchRequestComparison,
      icon: 'tabler:squares-filled',
    },
  }
}

function calculateComparison(currentPeriodValue: number, previousPeriodValue: number) {
  if (previousPeriodValue === 0) {
    return undefined
  }
  return (currentPeriodValue - previousPeriodValue) / previousPeriodValue
}
