// import eruda from 'eruda'
import { loadGlobalConfigPromise } from '@/utils/config/config'
import { registerTranslationTriggers } from './translation-trigger'
import './style.css'

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    await loadGlobalConfigPromise
    // eruda.init()
    registerTranslationTriggers()
  },
})
