export function translationMessage() {
  const tabPageTranslationState = new Map<number, { enabled: boolean, ports: Browser.runtime.Port[] }>()

  browser.runtime.onConnect.addListener((port) => {
    const tabId = port.sender?.tab?.id
    if (tabId == null)
      return

    const entry = tabPageTranslationState.get(tabId) ?? { enabled: false, ports: [] }
    entry.ports.push(port)
    tabPageTranslationState.set(tabId, entry)

    port.postMessage({ type: 'STATUS_PUSH', enabled: entry.enabled })

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
