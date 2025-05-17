import { initializeConfig, loadAPIKeyFromEnv } from '@/utils/config/config'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'

const isPageTranslatedMap = new Map<number, boolean>()

export default defineBackground(async () => {
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
        url: 'https://readfrog.mengxi.work/tutorial/api-key',
      })
    }
  })

  onMessage('openOptionsPage', () => {
    logger.info('openOptionsPage')
    browser.runtime.openOptionsPage()
  })

  onMessage('getIsPageTranslated', (message) => {
    return isPageTranslatedMap.get(message.data.tabId)
  })

  onMessage('updateIsPageTranslated', (message) => {
    isPageTranslatedMap.set(message.data.tabId, message.data.isPageTranslated)
    sendMessage(
      'setIsPageTranslatedOnSideContent',
      {
        isPageTranslated: message.data.isPageTranslated,
      },
      message.data.tabId,
    )
  })

  onMessage('uploadIsPageTranslated', async (message) => {
    const tabId = message.sender.tab.id
    isPageTranslatedMap.set(tabId, message.data.isPageTranslated)
  })

  onMessage('popupRequestReadArticle', async (message) => {
    sendMessage('readArticle', undefined, message.data.tabId)
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    isPageTranslatedMap.delete(tabId)
  })
})
