import type { Config } from '@/types/config/config'
import { createShadowRootUi, defineContentScript } from '#imports'
import { TooltipProvider } from '@repo/ui/components/tooltip'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { kebabCase } from 'case-anything'
import { Provider as JotaiProvider } from 'jotai/react'
import { useHydrateAtoms } from 'jotai/utils'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { configAtom } from '@/utils/atoms/config'
import { getConfigFromStorage } from '@/utils/config/config'
import { APP_NAME } from '@/utils/constants/app'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { onMessage, sendMessage } from '@/utils/message'
import { protectSelectAllShadowRoot } from '@/utils/select-all'
import { insertShadowRootUIWrapperInto } from '@/utils/shadow-root'
import { queryClient } from '@/utils/trpc/client'
import { addStyleToShadow, mirrorDynamicStyles, protectInternalStyles } from '../../utils/styles'
import App from './app'
import { enablePageTranslationAtom, store } from './atoms'
import '@/assets/tailwind/theme.css'
import '@/assets/tailwind/text-small.css'

// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const config = await getConfigFromStorage() ?? DEFAULT_CONFIG
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

        // Listen for translation state changes from background
        onMessage('translationStateChanged', (msg) => {
          const { enabled } = msg.data
          store.set(enablePageTranslationAtom, enabled)
        })

        // Query initial translation state
        // translationStateChanged may get the enabled = true too early
        // so after render the app, the enablePageTranslationAtom may still be false (default value) even if the translation is enabled by detected language or url patterns
        // this is a workaround to get the initial translation state
        void (async () => {
          try {
            const enabled = await sendMessage('getEnablePageTranslationFromContentScript', undefined)
            store.set(enablePageTranslationAtom, enabled)
          }
          catch (error) {
            console.error('Failed to get initial translation state:', error)
          }
        })()

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
