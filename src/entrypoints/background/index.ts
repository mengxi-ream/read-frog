import { initializeConfig, loadAPIKeyFromEnv } from '@/utils/config/config'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'
import { setupAnkiHandler } from './anki-handler'
import { newUserGuide } from './new-user-guide'
import { setUpRequestQueue } from './request-queue'
import { translationMessage } from './translation'

export default defineBackground(() => {
  logger.info('Hello background!', { id: browser.runtime.id })

  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await storage.setItem<number>(
        'local:__configSchemaVersion',
        CONFIG_SCHEMA_VERSION,
      )
    }
    await initializeConfig()
    await loadAPIKeyFromEnv()
    // Open tutorial page when extension is installed
    if (details.reason === 'install') {
      await browser.tabs.create({
        url: 'https://readfrog.mengxi.work/guide/step-1',
      })
    }
  })

  onMessage('openOptionsPage', () => {
    logger.info('openOptionsPage')
    browser.runtime.openOptionsPage()
  })

  onMessage('popupRequestReadArticle', async (message) => {
    sendMessage('readArticle', undefined, message.data.tabId)
  })

  newUserGuide()
  translationMessage()

  setUpRequestQueue()
  setupAnkiHandler()
})
