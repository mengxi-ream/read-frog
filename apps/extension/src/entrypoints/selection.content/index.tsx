import { createShadowRootUi, defineContentScript } from '#imports'
import { QueryClientProvider } from '@tanstack/react-query'
import { kebabCase } from 'case-anything'
import ReactDOM from 'react-dom/client'
import { APP_NAME } from '@/utils/constants/app.ts'
import { protectSelectAllShadowRoot } from '@/utils/select-all'
import { insertShadowRootUIWrapperInto } from '@/utils/shadow-root'
import { addStyleToShadow } from '@/utils/styles'
import { queryClient } from '@/utils/trpc/client'
import App from './app'
import '@/assets/tailwind/theme.css'

// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
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
            <App />
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
