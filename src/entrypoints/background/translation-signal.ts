import type { Config } from '@/types/config/config'
import type { TranslationState } from '@/types/translation-state'
import { browser, storage } from '#imports'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { getTranslationStateKey } from '@/utils/constants/storage-keys'
import { shouldEnableAutoTranslation } from '@/utils/host/translate/auto-translation'
import { logger } from '@/utils/logger'
import { onMessage, sendMessage } from '@/utils/message'

export function translationMessage() {
  onMessage('getEnablePageTranslationByTabId', async (msg) => {
    const { tabId } = msg.data
    return await getTranslationState(tabId)
  })

  onMessage('getEnablePageTranslationFromContentScript', async (msg) => {
    const tabId = msg.sender?.tab?.id
    if (typeof tabId === 'number') {
      return await getTranslationState(tabId)
    }
    logger.error('Invalid tabId in getEnablePageTranslationFromContentScript', msg)
    return false
  })

  onMessage('tryToSetEnablePageTranslationByTabId', async (msg) => {
    const { tabId, enabled } = msg.data
    void sendMessage('askManagerToTogglePageTranslation', { enabled }, tabId)
  })

  onMessage('tryToSetEnablePageTranslationOnContentScript', async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { enabled } = msg.data
    if (typeof tabId === 'number') {
      logger.info('sending tryToSetEnablePageTranslationOnContentScript to manager', { enabled, tabId })
      await sendMessage('askManagerToTogglePageTranslation', { enabled }, tabId)
    }
    else {
      logger.error('tabId is not a number', msg)
    }
  })

  onMessage('checkAndAskAutoPageTranslation', async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { url, detectedCodeOrUnd } = msg.data
    if (typeof tabId === 'number') {
      const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
      if (!config)
        return
      const shouldEnable = await shouldEnableAutoTranslation(url, detectedCodeOrUnd, config)
      if (shouldEnable) {
        void sendMessage('askManagerToTogglePageTranslation', { enabled: true }, tabId)
      }
    }
  })

  onMessage('setAndNotifyPageTranslationStateChangedByManager', async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { enabled } = msg.data
    if (typeof tabId === 'number') {
      await storage.setItem<TranslationState>(
        getTranslationStateKey(tabId),
        { enabled },
      )
      void sendMessage('notifyTranslationStateChanged', { enabled }, tabId)
    }
    else {
      logger.error('tabId is not a number', msg)
    }
  })

  // === Helper Functions ===
  async function getTranslationState(tabId: number): Promise<boolean> {
    const state = await storage.getItem<TranslationState>(
      getTranslationStateKey(tabId),
    )
    return state?.enabled ?? false
  }

  // === Cleanup ===
  browser.tabs.onRemoved.addListener(async (tabId) => {
    await storage.removeItem(getTranslationStateKey(tabId))
  })

  // Clear translation state when navigating to a new page in the same tab
  browser.webNavigation.onCommitted.addListener(async (details) => {
    // Only handle main frame navigations, not iframes
    if (details.frameId !== 0)
      return

    await storage.removeItem(getTranslationStateKey(details.tabId))
  })
}
