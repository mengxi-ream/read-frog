import { kebabCase } from 'case-anything'
import { APP_NAME } from '@/utils/constants/app'
import { OFFICIAL_SITE_URL_PATTERNS } from '@/utils/constants/site'

export default defineContentScript({
  matches: OFFICIAL_SITE_URL_PATTERNS,
  async main() {
    onMessage('pinStateChanged', (msg) => {
      window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, ...msg }, '*')
    })

    window.addEventListener('message', async (e) => {
      if (e.source !== window)
        return
      const { source, type } = e.data || {}
      if (source === 'read-frog-page' && type === 'getPinState') {
        const isPinned = await sendMessage('getPinState', undefined)
        window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, type: 'getPinState', data: { isPinned } }, '*')
      }
    })
  },
})
