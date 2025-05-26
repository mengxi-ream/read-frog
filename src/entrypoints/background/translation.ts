import type { Config } from '@/types/config/config'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'

export function translationMessage() {
  const tabPageTranslationState = new Map<number, { enabled: boolean, ports: Browser.runtime.Port[] }>()

  async function shouldAutoEnable(url: string): Promise<boolean> {
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
    const autoTranslatePatterns = config?.translate.page.autoTranslatePatterns
    if (!autoTranslatePatterns)
      return false

    return autoTranslatePatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))
  }

  browser.runtime.onConnect.addListener(async (port) => {
    if (port.name !== 'translation') {
      return
    }

    const tabId = port.sender?.tab?.id
    const tabUrl = port.sender?.tab?.url
    if (tabId == null)
      return

    const entry = tabPageTranslationState.get(tabId) ?? { enabled: false, ports: [] }

    if (entry.ports.length === 0 && tabUrl && await shouldAutoEnable(tabUrl)) {
      entry.enabled = true
    }

    entry.ports.push(port)
    tabPageTranslationState.set(tabId, entry)

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
      // 检查新 URL 是否应该自动启用翻译
      const shouldEnable = await shouldAutoEnable(url)
      setEnabled(tabId, shouldEnable)
    }
  })

  function setEnabled(tabId: number, enabled: boolean) {
    const entry = tabPageTranslationState.get(tabId) ?? { enabled, ports: [] }
    entry.enabled = enabled
    tabPageTranslationState.set(tabId, entry)

    // 广播给本 tab 所有 content scripts
    entry.ports.forEach(p => p.postMessage({ type: 'STATUS_PUSH', enabled }))
  }
}
