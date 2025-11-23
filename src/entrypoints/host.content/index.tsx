import type { Config } from '@/types/config/config'
import { createShadowRootUi, defineContentScript, storage } from '#imports'
import { kebabCase } from 'case-anything'
import { Provider as JotaiProvider } from 'jotai'
import ReactDOM from 'react-dom/client'
// import eruda from 'eruda'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { getConfigFromStorage } from '@/utils/config/config'
import { APP_NAME } from '@/utils/constants/app'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { getDocumentInfo } from '@/utils/content'
import { logger } from '@/utils/logger'
import { onMessage, sendMessage } from '@/utils/message'
import { protectSelectAllShadowRoot } from '@/utils/select-all'
import { insertShadowRootUIWrapperInto } from '@/utils/shadow-root'
import { addStyleToShadow } from '@/utils/styles'
import App from './app'
import { bindTranslationShortcutKey } from './translation-control/bind-translation-shortcut'
import { registerNodeTranslationTriggers } from './translation-control/node-translation'
import { PageTranslationManager } from './translation-control/page-translation'
import './listen'
import './style.css'

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'manifest',
  async main(ctx) {
    // eruda.init()

    const ui = await createShadowRootUi(ctx, {
      name: `${kebabCase(APP_NAME)}-selection`,
      position: 'overlay',
      anchor: 'body',
      onMount: (container, shadow, shadowHost) => {
        // Container is a body, and React warns when creating a root on the body, so create a wrapper div
        const wrapper = insertShadowRootUIWrapperInto(container)
        addStyleToShadow(shadow)
        protectSelectAllShadowRoot(shadowHost, wrapper)

        // Create a root on the UI container and render a component
        const root = ReactDOM.createRoot(wrapper)
        root.render(
          <JotaiProvider>
            <ThemeProvider container={wrapper}>
              <App />
            </ThemeProvider>
          </JotaiProvider>,
        )
        return root
      },
      onRemove: (root) => {
        // Unmount the root when the UI is removed
        root?.unmount()
      },
    })

    // 4. Mount the UI
    ui.mount()

    void registerNodeTranslationTriggers()

    const manager = new PageTranslationManager({
      root: null,
      rootMargin: '1000px',
      threshold: 0,
    })

    // Removed shortcutKeyManager class

    manager.registerPageTranslationTriggers()

    const handleUrlChange = (from: string, to: string) => {
      if (from !== to) {
        logger.info('URL changed from', from, 'to', to)
        if (manager.isActive) {
          manager.stop()
        }
        // Notify background script that URL has changed, let it decide whether to automatically enable translation
        void sendMessage('checkAndSetAutoTranslation', { url: to })
      }
    }

    window.addEventListener('extension:URLChange', (e: any) => {
      const { from, to } = e.detail
      handleUrlChange(from, to)
    })

    void bindTranslationShortcutKey(manager)

    // This may not work when the tab is not active, if so, need refresh the webpage
    storage.watch(`local:${CONFIG_STORAGE_KEY}`, () => {
      void bindTranslationShortcutKey(manager)
    })

    // Listen for translation state changes from background
    onMessage('translationStateChanged', (msg) => {
      logger.info('translationStateChanged', msg.data)
      const { enabled } = msg.data
      if (enabled === manager.isActive)
        return
      enabled ? void manager.start() : manager.stop()
    })

    const config = await getConfigFromStorage()
    if (config) {
      const { detectedCode } = getDocumentInfo()
      await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
        ...config,
        language: { ...config.language, detectedCode },
      })

      // Check if auto-translation should be enabled for initial page load
      void sendMessage('checkAndSetAutoTranslation', { url: window.location.href })
    }
  },
})
