import { i18n } from '#imports'
import floatingButtonDemoImage from '@/assets/demo/floating-button.png'
import { GradientBackground } from '@/components/gradient-background'
import { PageLayout } from '../../components/page-layout'
import { FloatingButtonClickAction } from './floating-button-click-action'
import { FloatingButtonDisabledSites } from './floating-button-disabled-sites'
import { FloatingButtonGlobalToggle } from './floating-button-global-toggle'

export function FloatingButtonPage() {
  return (
    <PageLayout title={i18n.t('options.overlayTools.floatingButton.title')}>
      <GradientBackground>
        <img
          src={floatingButtonDemoImage}
          alt={i18n.t('options.floatingButtonAndToolbar.floatingButtonDemoImageAlt')}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <FloatingButtonGlobalToggle />
        <FloatingButtonClickAction />
        <FloatingButtonDisabledSites />
      </div>
    </PageLayout>
  )
}
