import { PageLayout } from '../../components/page-layout'
import { ReadConfig } from './read-config'
import TranslationConfig from './translation-config'

export function GeneralPage() {
  return (
    <PageLayout title="General" innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      <ReadConfig />
      <TranslationConfig />
    </PageLayout>
  )
}
