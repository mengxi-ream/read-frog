import { i18n } from '#imports'
import selectionToolbarDemoImage from '@/assets/demo/selection-toolbar.png'
import { GradientBackground } from '@/components/gradient-background'
import { PageLayout } from '../../components/page-layout'
import { SelectionToolbarDisabledSites } from './selection-toolbar-disabled-sites'
import { SelectionToolbarGlobalToggle } from './selection-toolbar-global-toggle'

export function SelectionToolbarPage() {
  return (
    <PageLayout title={i18n.t('options.overlayTools.selectionToolbar.title')}>
      <GradientBackground>
        <img
          src={selectionToolbarDemoImage}
          alt={i18n.t('options.floatingButtonAndToolbar.selectionToolbarDemoImageAlt')}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <SelectionToolbarGlobalToggle />
        <SelectionToolbarDisabledSites />
      </div>
    </PageLayout>
  )
}
