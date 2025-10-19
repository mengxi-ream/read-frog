import { useAtomValue } from 'jotai'
import { MetricCard } from '@/entrypoints/options/components/metric-card'
import { calculateAverageSavePercentage } from './aside'
import { batchRequestRecordsAtom } from './atom'

export default function Metrics() {
  const batchRequestRecords = useAtomValue(batchRequestRecordsAtom)

  const savingPercentage = calculateAverageSavePercentage(batchRequestRecords)
  const originalRequests = batchRequestRecords.length
  const batchRequests = batchRequestRecords.reduce((acc, record) => acc + record.originalRequestCount, 0)

  const metrics = {
    savingPercentage: { title: '近30日批量翻译节省百分比', value: savingPercentage, comparison: 10, icon: 'tabler:circle-percentage-filled' },
    originalRequests: { title: '近30日原始请求数量', value: originalRequests, comparison: -10, icon: 'tabler:circle-filled' },
    batchRequests: { title: '近30日批量请求数量', value: batchRequests, comparison: -10, icon: 'tabler:squares-filled' },
  }

  return (
    <header className="h-fit w-full grid gap-4 grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1">
      { Object.entries(metrics).map(([key, metric]) => <MetricCard key={key} {...metric} />) }
    </header>
  )
}
