import { MetricCard } from '@/entrypoints/options/components/metric-card'
import { addThousandsSeparator } from '@/utils/utils'

export function Metrics() {
  const metrics = {
    savingPercentage: { title: '批量翻译节省请求百分比', value: '80%', comparison: 10, icon: 'tabler:circle-percentage-filled' },
    originalRequests: { title: '原始请求数量', value: '1,000', comparison: -10, icon: 'tabler:circle-filled' },
    batchRequests: { title: '批量请求数量', value: '200', comparison: -10, icon: 'tabler:squares-filled' },
  }

  return (
    <header className="h-fit w-full grid gap-4 grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1">
      { Object.entries(metrics).map(([key, metric]) => <MetricCard key={key} {...metric} />) }
    </header>
  )
}
