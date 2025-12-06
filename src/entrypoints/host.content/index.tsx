import type { Config } from '@/types/config/config'
import { createShadowRootUi, defineContentScript, storage } from '#imports'
import { kebabCase } from 'case-anything'
import ReactDOM from 'react-dom/client'
// import eruda from 'eruda'
import { getConfigFromStorage } from '@/utils/config/config'
import { APP_NAME } from '@/utils/constants/app'
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from '@/utils/constants/config'
import { getDocumentInfo } from '@/utils/content/analyze'
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
          <App />,
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

    const initialConfig = await getConfigFromStorage()
    const preloadConfig = initialConfig?.translate.page.preload ?? DEFAULT_CONFIG.translate.page.preload
    const manager = new PageTranslationManager({
      root: null,
      rootMargin: `${preloadConfig.margin}px`,
      threshold: preloadConfig.threshold,
    })

    // Removed shortcutKeyManager class

    manager.registerPageTranslationTriggers()

    const handleUrlChange = async (from: string, to: string) => {
      if (from !== to) {
        logger.info('URL changed from', from, 'to', to)
        if (manager.isActive) {
          manager.stop()
        }
        const config = await getConfigFromStorage()
        if (!config)
          return
        const { detectedCodeOrUnd } = await getDocumentInfo()
        await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
          ...config,
          language: { ...config.language, detectedCode: detectedCodeOrUnd === 'und' ? 'eng' : detectedCodeOrUnd },
        })
        // Notify background script that URL has changed, let it decide whether to automatically enable translation
        void sendMessage('checkAndAskAutoPageTranslation', { url: to, detectedCodeOrUnd })
      }
    }

    window.addEventListener('extension:URLChange', (e: any) => {
      const { from, to } = e.detail
      void handleUrlChange(from, to)
    })

    void bindTranslationShortcutKey(manager)

    // This may not work when the tab is not active, if so, need refresh the webpage
    storage.watch(`local:${CONFIG_STORAGE_KEY}`, () => {
      void bindTranslationShortcutKey(manager)
    })

    // Listen for translation state changes from background
    onMessage('askManagerToTogglePageTranslation', (msg) => {
      const { enabled } = msg.data
      if (enabled === manager.isActive)
        return
      enabled ? void manager.start() : manager.stop()
    })

    const config = await getConfigFromStorage()
    if (config) {
      const { detectedCodeOrUnd } = await getDocumentInfo()
      await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
        ...config,
        language: { ...config.language, detectedCode: detectedCodeOrUnd === 'und' ? 'eng' : detectedCodeOrUnd },
      })

      // Check if auto-translation should be enabled for initial page load
      void sendMessage('checkAndAskAutoPageTranslation', { url: window.location.href, detectedCodeOrUnd })
    }
  },
})
