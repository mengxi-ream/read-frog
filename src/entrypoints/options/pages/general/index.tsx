import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { SiteControlMode } from './components/site-control/site-control-mode'
import { SiteControlPatterns } from './components/site-control/site-control-patterns'
import FeatureProvidersConfig from './feature-providers-config'
import TranslationConfig from './translation-config'

export function GeneralPage() {
  return (
    <PageLayout title={i18n.t('options.general.title')} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <FeatureProvidersConfig />
      <TranslationConfig />
      <SiteControlMode />
      <SiteControlPatterns />
    </PageLayout>
  )
}
