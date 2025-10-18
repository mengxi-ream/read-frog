import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { BatchRequestSaving } from './charts'
import { Metrics } from './metrics'

export function StatisticsPage() {
  return (
    <PageLayout
      title={i18n.t('options.statistics.title')}
      innerClassName="p-8"
    >
      <Metrics />
      <BatchRequestSaving />
    </PageLayout>
  )
}
