import type { Config } from '@/types/config/config'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { kebabCase } from 'case-anything'
import { Provider as JotaiProvider } from 'jotai/react'

import { useHydrateAtoms } from 'jotai/utils'
import ReactDOM from 'react-dom/client'

import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { configAtom } from '@/utils/atoms/config'
import { globalConfig, loadGlobalConfig } from '@/utils/config/config'
import { APP_NAME } from '@/utils/constants/app'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { protectSelectAllShadowRoot } from '@/utils/select-all'
import { addStyleToShadow, mirrorDynamicStyles } from '../../utils/styles'
import App from './app'

import { enablePageTranslationAtom, store, translationPortAtom } from './atoms'
import '@/assets/tailwind/text-small.css'
import '@/assets/tailwind/theme.css'
import '@/entrypoints/host.content/style.css'

// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    await loadGlobalConfig()
    const config = globalConfig ?? DEFAULT_CONFIG
    const ui = await createShadowRootUi(ctx, {
      name: kebabCase(APP_NAME),
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container, shadow, shadowHost) => {
        // Store shadow root reference
        const wrapper = document.createElement('div')
        wrapper.className = cn(
          'text-base antialiased font-sans z-[2147483647]',
          isDarkMode() && 'dark',
        )
        shadowWrapper = wrapper
        container.appendChild(wrapper)

        const root = ReactDOM.createRoot(wrapper)

        addStyleToShadow(shadow)
        mirrorDynamicStyles('#_goober', shadow)
        // mirrorDynamicStyles(
        //   "style[type='text/css']",
        //   shadow,
        //   ".with-scroll-bars-hidden22"
        // );

        protectSelectAllShadowRoot(shadowHost, wrapper)

        const queryClient = new QueryClient({
          queryCache: new QueryCache({
            onError: (error, query) => {
              const errorDescription
                = query.meta?.errorDescription || 'Something went wrong'
              toast.error(`${errorDescription}: ${error.message}`)
            },
          }),
          mutationCache: new MutationCache({
            onError: (error, _variables, _context, mutation) => {
              const errorDescription
                = mutation.meta?.errorDescription || 'Something went wrong'
              toast.error(`${errorDescription}: ${error.message}`)
            },
          }),
        })

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

        buildTranslationPort()

        root.render(
          <QueryClientProvider client={queryClient}>
            <JotaiProvider store={store}>
              <HydrateAtoms
                initialValues={[[configAtom, config]]}
              >
                <TooltipProvider>
                  <App />
                </TooltipProvider>
              </HydrateAtoms>
            </JotaiProvider>
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
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

function buildTranslationPort() {
  const port = browser.runtime.connect({ name: 'translation-side.content' })
  store.set(translationPortAtom, port)
  port.onMessage.addListener((msg: any) => {
    if (msg.type === 'STATUS_PUSH') {
      const currentAtom = store.get(enablePageTranslationAtom)
      const enabled = msg.enabled ?? false
      if (currentAtom !== enabled) {
        store.set(enablePageTranslationAtom, enabled)
      }
    }
  })
}
