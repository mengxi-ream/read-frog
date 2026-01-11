import { createShadowRootUi, defineContentScript } from '#imports'
import { QueryClientProvider } from '@tanstack/react-query'
import { kebabCase } from 'case-anything'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { getLocalConfig } from '@/utils/config/storage'
import { APP_NAME } from '@/utils/constants/app.ts'
import { protectSelectAllShadowRoot } from '@/utils/select-all'
import { insertShadowRootUIWrapperInto } from '@/utils/shadow-root'
import { isSiteEnabled } from '@/utils/site-control'
import { addStyleToShadow } from '@/utils/styles'
import { queryClient } from '@/utils/tanstack-query'
import App from './app'
import '@/assets/styles/theme.css'

// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

declare global {
  interface Window {
    __READ_FROG_SELECTION_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  allFrames: true,
  async main(ctx) {
    // Prevent double injection (manifest-based + programmatic injection)
    if (window.__READ_FROG_SELECTION_INJECTED__)
      return
    window.__READ_FROG_SELECTION_INJECTED__ = true

    // Check global site control
    const config = await getLocalConfig()
    if (!isSiteEnabled(window.location.href, config)) {
      return
    }

    const ui = await createShadowRootUi(ctx, {
      name: `${kebabCase(APP_NAME)}-selection`,
      position: 'overlay',
      anchor: 'body',
      onMount: (container, shadow, shadowHost) => {
        // Container is a body, and React warns when creating a root on the body, so create a wrapper div
        const wrapper = insertShadowRootUIWrapperInto(container)
        shadowWrapper = wrapper
        addStyleToShadow(shadow)
        protectSelectAllShadowRoot(shadowHost, wrapper)

        // Create a root on the UI container and render a component
        const root = ReactDOM.createRoot(wrapper)
        root.render(
          <QueryClientProvider client={queryClient}>
            <ThemeProvider container={wrapper}>
              <App />
            </ThemeProvider>
          </QueryClientProvider>,
        )
        return root
      },
      onRemove: (root) => {
        // Unmount the root when the UI is removed
        root?.unmount()
        shadowWrapper = null
      },
    })

    // 4. Mount the UI
    ui.mount()
  },
})
