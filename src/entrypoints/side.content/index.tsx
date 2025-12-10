import type { Config } from '@/types/config/config'
import { createShadowRootUi, defineContentScript } from '#imports'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { kebabCase } from 'case-anything'
import { Provider as JotaiProvider } from 'jotai/react'
import { useHydrateAtoms } from 'jotai/utils'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { TooltipProvider } from '@/components/shadcn/tooltip'
import { configAtom } from '@/utils/atoms/config'
import { getLocalConfig } from '@/utils/config/storage'
import { APP_NAME } from '@/utils/constants/app'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { protectSelectAllShadowRoot } from '@/utils/select-all'
import { insertShadowRootUIWrapperInto } from '@/utils/shadow-root'
import { queryClient } from '@/utils/tanstack-query'
import { addStyleToShadow, mirrorDynamicStyles, protectInternalStyles } from '../../utils/styles'
import App from './app'
import { store } from './atoms'
import '@/assets/styles/theme.css'
import '@/assets/styles/text-small.css'

// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const config = await getLocalConfig() ?? DEFAULT_CONFIG
    const ui = await createShadowRootUi(ctx, {
      name: kebabCase(APP_NAME),
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container, shadow, shadowHost) => {
        // Store shadow root reference
        const wrapper = insertShadowRootUIWrapperInto(container)
        shadowWrapper = wrapper

        addStyleToShadow(shadow)
        mirrorDynamicStyles('#_goober', shadow)
        // mirrorDynamicStyles(
        //   "style[type='text/css']",
        //   shadow,
        //   ".with-scroll-bars-hidden22"
        // );

        // Protect internal style elements from being removed
        protectInternalStyles()

        protectSelectAllShadowRoot(shadowHost, wrapper)

        const HydrateAtoms = ({
          initialValues,
          children,
        }: {
          initialValues: [[typeof configAtom, Config]]
          children: React.ReactNode
        }) => {
          useHydrateAtoms(initialValues)
          return children
        }

        // Translation state is now synced automatically via enablePageTranslationAtom
        // which uses session storage with the createTabSessionAtom pattern

        const root = ReactDOM.createRoot(wrapper)
        root.render(
          <QueryClientProvider client={queryClient}>
            <JotaiProvider store={store}>
              <HydrateAtoms
                initialValues={[[configAtom, config]]}
              >
                <ThemeProvider container={wrapper}>
                  <TooltipProvider>
                    <App />
                  </TooltipProvider>
                </ThemeProvider>
              </HydrateAtoms>
            </JotaiProvider>
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-right"
            />
          </QueryClientProvider>,
        )
        return { root, wrapper }
      },
      onRemove: (elements) => {
        elements?.root.unmount()
        elements?.wrapper.remove()
        shadowWrapper = null
      },
    })

    ui.mount()
  },
})
