// import eruda from 'eruda'
import { loadGlobalConfigPromise } from '@/utils/config/config'
import { registerTranslationTriggers } from './translation-trigger'
import { observeAndTranslateVisibleElements } from './translation-trigger/page-translation'
import './style.css'

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    await loadGlobalConfigPromise
    // eruda.init()
    registerTranslationTriggers()

    const stop = observeAndTranslateVisibleElements()

    return () => {
      stop()
    }
  },
})
