import type { Config } from '@/types/config/config'
import { kebabCase } from 'case-anything'
import { APP_NAME } from '@/utils/constants/app'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
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
      else if (source === 'read-frog-page' && type === 'setTargetLanguage') {
        const langCodeISO6393 = e.data.langCodeISO6393 ?? 'eng'
        const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
        if (!config)
          return
        await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
          ...config,
          language: { ...config.language, targetCode: langCodeISO6393 },
        })
      }
      else if (source === 'read-frog-page' && type === 'getTargetLanguage') {
        const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
        const targetLanguage = config?.language.targetCode
        window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, type: 'getTargetLanguage', data: { targetLanguage } }, '*')
      }
    })
  },
})
