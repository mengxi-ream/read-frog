// import eruda from 'eruda'
import { loadGlobalConfigPromise } from '@/utils/config/config'
import { registerTranslationTriggers } from './translation-trigger'
import { PageTranslationManager } from './translation-trigger/page-translation'
import './listen'
import './style.css'

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    await loadGlobalConfigPromise
    // eruda.init()
    registerTranslationTriggers()

    const port = browser.runtime.connect({ name: 'translation' })
    const manager = new PageTranslationManager({
      root: null,
      rootMargin: '1000px',
      threshold: 0.1,
    })

    const handleUrlChange = (from: string, to: string) => {
      if (from !== to) {
        logger.info('URL changed from', from, 'to', to)
        if (manager.isActive) {
          manager.stop()
        }
        // 通知 background script URL 已变化，让它决定是否自动启用翻译
        sendMessage('resetPageTranslationOnNavigation', { url: to })
      }
    }

    window.addEventListener('extension:urlchange', (e: any) => {
      const { from, to, reason } = e.detail
      logger.info('URL changed from', from, 'to', to, 'reason', reason)
      handleUrlChange(from, to)
    })

    port.onMessage.addListener((msg) => {
      if (msg.type !== 'STATUS_PUSH')
        return
      if (msg.enabled === manager.isActive)
        return
      msg.enabled ? manager.start() : manager.stop()
    })
  },
})
