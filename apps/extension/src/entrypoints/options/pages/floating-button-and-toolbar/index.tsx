import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { FloatingButtonDisabledSites } from './floating-button-disabled-sites'
import { FloatingButtonGlobalToggle } from './floating-button-global-toggle'

export function FloatingButtonAndToolbarPage() {
  return (
    <PageLayout title={i18n.t('options.floatingButtonAndToolbar.title')} innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      <FloatingButtonGlobalToggle />
      <FloatingButtonDisabledSites />
    </PageLayout>
  )
}
