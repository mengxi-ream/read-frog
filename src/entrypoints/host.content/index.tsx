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

    const manager = new PageTranslationManager({
      root: null,
      rootMargin: '1000px',
      threshold: 0.1,
    })

    manager.start()
  },
})
