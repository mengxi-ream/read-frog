// import eruda from 'eruda'
import { loadGlobalConfigPromise } from '@/utils/config/config'
import { registerTranslationTriggers } from './translation-trigger'
import { PageTranslationManager } from './translation-trigger/page-translation'
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

    port.onMessage.addListener((msg) => {
      if (msg.type !== 'STATUS_PUSH')
        return
      if (msg.enabled === manager.isActive)
        return
      msg.enabled ? manager.start() : manager.stop()
    })
  },
})
