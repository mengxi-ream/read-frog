import { i18n } from '#imports'
import floatingButtonDemoImage from '@/assets/demo/floating-button.png'
import selectionToolbarDemoImage from '@/assets/demo/selection-toolbar.png'
import { GradientBackground } from '@/components/gradient-background'
import { PageLayout } from '../../components/page-layout'
import { FloatingButtonDisabledSites } from './floating-button-disabled-sites'
import { FloatingButtonGlobalToggle } from './floating-button-global-toggle'
import { SelectionToolbarGlobalToggle } from './selection-toolbar-global-toggle'

export function FloatingButtonAndToolbarPage() {
  return (
    <PageLayout title={i18n.t('options.floatingButtonAndToolbar.title')}>
      <GradientBackground>
        <img
          src={floatingButtonDemoImage}
          alt={i18n.t('options.floatingButtonAndToolbar.floatingButtonDemoImageAlt')}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <FloatingButtonGlobalToggle />
      <FloatingButtonDisabledSites />
      <GradientBackground>
        <img
          src={selectionToolbarDemoImage}
          alt={i18n.t('options.floatingButtonAndToolbar.selectionToolbarDemoImageAlt')}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <SelectionToolbarGlobalToggle />
    </PageLayout>
  )
}
