import { i18n } from '#imports'
import floatingButtonDemoImage from '@/assets/demo/floating-button.png'
import { PageLayout } from '../../components/page-layout'
import { FloatingButtonDisabledSites } from './floating-button-disabled-sites'
import { FloatingButtonGlobalToggle } from './floating-button-global-toggle'
import { SelectionToolbarGlobalToggle } from './selection-toolbar-global-toggle'

export function FloatingButtonAndToolbarPage() {
  const svg = `<svg viewBox='0 0 500 500' xmlns='http://www.w3.org/2000/svg'>
  <filter id='noiseFilter'>
    <feTurbulence
      type='fractalNoise'
      baseFrequency='0.65'
      numOctaves='3'
      stitchTiles='stitch'/>
    <feColorMatrix type='saturate' values='0'/>
  </filter>

  <rect width='100%' height='100%' filter='url(#noiseFilter)' opacity='0.3'/>
</svg>`

  return (
    <PageLayout title={i18n.t('options.floatingButtonAndToolbar.title')}>
      <div
        className="w-full py-8 flex items-center justify-center rounded-xl my-8"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 70% 10%, rgba(59 246 121 / 0.15), transparent)',
            'radial-gradient(circle at 0% 80%, rgba(235 250 21 / 0.15), transparent)',
            'radial-gradient(circle at 50% 50%, rgba(233 170 10 / 0.1), transparent)',
            `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
          ].join(', '),
        }}
      >
        <img src={floatingButtonDemoImage} alt="Floating Button Demo" className="w-100 h-auto" />
      </div>
      <div>
        <FloatingButtonGlobalToggle />
        <FloatingButtonDisabledSites />
        <SelectionToolbarGlobalToggle />
      </div>
    </PageLayout>
  )
}
