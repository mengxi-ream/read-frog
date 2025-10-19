import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { BatchRequestRecord } from './charts'

export function StatisticsPage() {
  return (
    <PageLayout
      title={i18n.t('options.statistics.title')}
      innerClassName="flex flex-col p-8 gap-8"
    >
      <BatchRequestRecord />
    </PageLayout>
  )
}
