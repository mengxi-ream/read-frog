export function translationMessage() {
  const tabPageTranslationState = new Map<number, { enabled: boolean, ports: Browser.runtime.Port[] }>()

  // 定义需要默认启用翻译的URL正则模式
  const AUTO_ENABLE_URL_PATTERNS = [
    /^https?:\/\/.*\.wikipedia\.org\//, // Wikipedia
    /^https?:\/\/reddit\.com\//, // Reddit
    /^https?:\/\/stackoverflow\.com\//, // Stack Overflow
    /^https?:\/\/github\.com\//, // GitHub
    // 可以根据需要添加更多模式
  ]

  function shouldAutoEnable(url: string): boolean {
    return AUTO_ENABLE_URL_PATTERNS.some(pattern => pattern.test(url))
  }

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'translation') {
      return
    }

    const tabId = port.sender?.tab?.id
    const tabUrl = port.sender?.tab?.url
    if (tabId == null)
      return

    const entry = tabPageTranslationState.get(tabId) ?? { enabled: false, ports: [] }

    if (entry.ports.length === 0 && tabUrl && shouldAutoEnable(tabUrl)) {
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

  function setEnabled(tabId: number, enabled: boolean) {
    const entry = tabPageTranslationState.get(tabId) ?? { enabled, ports: [] }
    entry.enabled = enabled
    tabPageTranslationState.set(tabId, entry)

    // 广播给本 tab 所有 content scripts
    entry.ports.forEach(p => p.postMessage({ type: 'STATUS_PUSH', enabled }))
  }
}
