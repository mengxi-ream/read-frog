import { PageLayout } from '../../components/page-layout'
import { AlwaysTranslate } from './always-translate'
import TranslationConfig from './translation-config'

export function TranslationPage() {
  return (
    <PageLayout title={i18n.t('options.translation.title')} innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      <AlwaysTranslate />
      <TranslationConfig />
    </PageLayout>
  )
}
