import { PageLayout } from '../../components/page-layout'
import { ReadConfig } from './read-config'
import { ResetConfig } from './reset-config'
import TranslationConfig from './translation-config'

export function GeneralPage() {
  return (
    <PageLayout title={i18n.t('options.general.title')} innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      <ReadConfig />
      <TranslationConfig />
      <ResetConfig />
    </PageLayout>
  )
}
