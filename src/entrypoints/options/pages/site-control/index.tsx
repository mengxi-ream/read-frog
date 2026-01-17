import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { SiteControlMode } from './site-control-mode'
import { SiteControlPatterns } from './site-control-patterns'

export function SiteControlPage() {
  return (
    <PageLayout title={i18n.t('options.siteControl.title')}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <SiteControlMode />
        <SiteControlPatterns />
      </div>
    </PageLayout>
  )
}
