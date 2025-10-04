import { browser, defineBackground } from '#imports'
import { WEBSITE_URL } from '@/utils/constants/url'
import { logger } from '@/utils/logger'
import { onMessage, sendMessage } from '@/utils/message'
import { cleanupAllCache, setUpCacheCleanup } from './cache-cleanup'
import { ensureInitializedConfig } from './config'
import { newUserGuide } from './new-user-guide'
import { proxyFetch } from './proxy-fetch'
import { setUpRequestQueue } from './translation-queues'
import { translationMessage } from './translation-signal'
import { setupUninstallSurvey } from './uninstall-survey'

export default defineBackground({
  type: 'module',
  main: () => {
    logger.info('Hello background!', { id: browser.runtime.id })

    browser.runtime.onInstalled.addListener(async (details) => {
      await ensureInitializedConfig()
      // Open tutorial page when extension is installed
      if (details.reason === 'install') {
        await browser.tabs.create({
          url: `${WEBSITE_URL}/guide/step-1`,
        })
      }
    })

    onMessage('openPage', async (message) => {
      const { url, active } = message.data
      logger.info('openPage', { url, active })
      await browser.tabs.create({ url, active: active ?? true })
    })

    onMessage('openOptionsPage', () => {
      logger.info('openOptionsPage')
      void browser.runtime.openOptionsPage()
    })

    onMessage('popupRequestReadArticle', async (message) => {
      void sendMessage('readArticle', undefined, message.data.tabId)
    })

    onMessage('clearAllCache', async () => {
      await cleanupAllCache()
    })

    newUserGuide()
    translationMessage()

    void setUpRequestQueue()
    setUpCacheCleanup()
    void setupUninstallSurvey()

    proxyFetch()
  },
})
