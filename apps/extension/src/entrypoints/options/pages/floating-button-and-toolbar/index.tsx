import { i18n } from '#imports'
import floatingButtonDemoImage from '@/assets/demo/floating-button.png'
import { PageLayout } from '../../components/page-layout'
import { FloatingButtonDisabledSites } from './floating-button-disabled-sites'
import { FloatingButtonGlobalToggle } from './floating-button-global-toggle'
import { SelectionToolbarGlobalToggle } from './selection-toolbar-global-toggle'

export function FloatingButtonAndToolbarPage() {
  return (
    <PageLayout title={i18n.t('options.floatingButtonAndToolbar.title')}>
      <img src={floatingButtonDemoImage} alt="Floating Button Demo" className="w-20 h-auto mx-auto" />
      <FloatingButtonGlobalToggle />
      <FloatingButtonDisabledSites />
      <SelectionToolbarGlobalToggle />
    </PageLayout>
  )
}
