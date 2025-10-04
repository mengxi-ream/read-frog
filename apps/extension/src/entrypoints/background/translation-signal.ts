import type { Browser } from '#imports'
import type { Config } from '@/types/config/config'
import { browser, storage } from '#imports'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { shouldEnableAutoTranslation } from '@/utils/host/translate/auto-translation'
import { logger } from '@/utils/logger'
import { onMessage } from '@/utils/message'
import { ensureKeyInMap } from '@/utils/utils'

export function translationMessage() {
  const tabPageTranslationState = new Map<number, { enabled: boolean, ports: Browser.runtime.Port[] }>()

  browser.runtime.onConnect.addListener(async (port) => {
    if (!port.name.startsWith('translation')) {
      return
    }

    const tabId = port.sender?.tab?.id
    const tabUrl = port.sender?.tab?.url
    if (tabId == null)
      return

    const entry = ensureKeyInMap(tabPageTranslationState, tabId, () => ({
      enabled: false,
      ports: [] as Browser.runtime.Port[],
    }))

    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
    const autoEnable = config && tabUrl && await shouldEnableAutoTranslation(tabUrl, config)
    if (entry.ports.length === 0 && autoEnable) {
      entry.enabled = true
    }

    entry.ports.push(port)

    port.postMessage({ type: 'STATUS_PUSH', enabled: entry.enabled })

    port.onMessage.addListener((message) => {
      if (message.type === 'REQUEST_STATUS') {
        const currentEntry = tabPageTranslationState.get(tabId)
        port.postMessage({
          type: 'STATUS_PUSH',
          enabled: currentEntry?.enabled ?? false,
        })
      }
    })

    port.onDisconnect.addListener(() => {
      const left = entry.ports.filter(p => p !== port)
      if (left.length)
        entry.ports = left
      else tabPageTranslationState.delete(tabId)
    })
  })

  onMessage('getEnablePageTranslation', (msg) => {
    const { tabId } = msg.data
    const enabled = tabPageTranslationState.get(tabId)?.enabled
    return enabled
  })

  onMessage('setEnablePageTranslation', (msg) => {
    const { tabId, enabled } = msg.data
    setEnabled(tabId, enabled)
  })

  onMessage('setEnablePageTranslationOnContentScript', (msg) => {
    const tabId = msg.sender?.tab?.id
    const { enabled } = msg.data
    if (typeof tabId === 'number')
      setEnabled(tabId, enabled)
    else
      logger.error('tabId is not a number', msg)
  })

  onMessage('resetPageTranslationOnNavigation', async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { url } = msg.data
    if (typeof tabId === 'number') {
      const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
      if (!config)
        return
      const shouldEnable = await shouldEnableAutoTranslation(url, config)
      setEnabled(tabId, shouldEnable)
    }
  })

  function setEnabled(tabId: number, enabled: boolean) {
    const entry = ensureKeyInMap(tabPageTranslationState, tabId, () => ({
      enabled: false,
      ports: [] as Browser.runtime.Port[],
    }))

    entry.enabled = enabled

    // broadcast to all content scripts in this tab
    entry.ports.forEach(p => p.postMessage({ type: 'STATUS_PUSH', enabled }))
  }
}
