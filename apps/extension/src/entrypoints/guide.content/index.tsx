import type { Config } from '@/types/config/config'
import { kebabCase } from 'case-anything'
import { globalConfig, loadGlobalConfig } from '@/utils/config/config'
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
      await loadGlobalConfig()
      if (!globalConfig)
        return
      if (e.source !== window)
        return
      const { source, type } = e.data || {}
      if (source === 'read-frog-page' && type === 'getPinState') {
        const isPinned = await sendMessage('getPinState', undefined)
        window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, type: 'getPinState', data: { isPinned } }, '*')
      }
      else if (source === 'read-frog-page' && type === 'setTargetLanguage') {
        const langCodeISO6393 = e.data.langCodeISO6393 ?? 'eng'
        // If we set storage too early, react of side content has not been mounted yet,
        // so this set storage will not trigger the watch of storage adapter of atom in react of side content
        // i.e. the side content will not be updated with the new config
        // thus extract query will set the target language back to initial config when it call setLanguage
        await new Promise(resolve => setTimeout(resolve, 500))
        await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
          ...globalConfig,
          language: { ...globalConfig.language, targetCode: langCodeISO6393 },
        })
      }
      else if (source === 'read-frog-page' && type === 'getTargetLanguage') {
        const targetLanguage = globalConfig.language.targetCode
        window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, type: 'getTargetLanguage', data: { targetLanguage } }, '*')
      }
    })
  },
})
