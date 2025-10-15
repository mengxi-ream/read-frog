import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { BatchRequestCache } from './batch-request-cache'
import { VChartRegister } from './register-chart'

export function StatisticsPage() {
  return (
    <PageLayout
      title={i18n.t('options.statistics.title')}
      innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0"
    >
      <VChartRegister />
      <BatchRequestCache />
    </PageLayout>
  )
}
