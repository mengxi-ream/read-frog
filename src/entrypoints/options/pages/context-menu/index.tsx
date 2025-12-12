import { i18n } from '#imports'
import contextMenuDemoImage from '@/assets/demo/context-menu.png'
import { GradientBackground } from '@/components/gradient-background'
import { PageLayout } from '../../components/page-layout'
import { ContextMenuTranslateToggle } from './context-menu-translate-toggle'

export function ContextMenuPage() {
  return (
    <PageLayout title={i18n.t('options.overlayTools.contextMenu.title')}>
      <GradientBackground>
        <img
          src={contextMenuDemoImage}
          alt={i18n.t('options.floatingButtonAndToolbar.selectionToolbarDemoImageAlt')}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <ContextMenuTranslateToggle />
      </div>
    </PageLayout>
  )
}
