import { i18n } from '#imports'
import floatingButtonDemoImage from '@/assets/demo/floating-button.png'
import selectionToolbarDemoImage from '@/assets/demo/selection-toolbar.png'
import { GradientBackground } from '@/components/gradient-background'
import { PageLayout } from '../../components/page-layout'
import { ContextMenuTranslateToggle } from './context-menu-translate-toggle'
import { FloatingButtonClickAction } from './floating-button-click-action'
import { FloatingButtonDisabledSites } from './floating-button-disabled-sites'
import { FloatingButtonGlobalToggle } from './floating-button-global-toggle'
import { SelectionToolbarDisabledSites } from './selection-toolbar-disabled-sites'
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
      <FloatingButtonClickAction />
      <FloatingButtonDisabledSites />
      <GradientBackground>
        <img
          src={selectionToolbarDemoImage}
          alt={i18n.t('options.floatingButtonAndToolbar.selectionToolbarDemoImageAlt')}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <SelectionToolbarGlobalToggle />
      <SelectionToolbarDisabledSites />
      <h2 className="text-lg font-semibold mt-6 mb-2">
        {i18n.t('options.floatingButtonAndToolbar.contextMenu.title')}
      </h2>
      <ContextMenuTranslateToggle />
    </PageLayout>
  )
}
