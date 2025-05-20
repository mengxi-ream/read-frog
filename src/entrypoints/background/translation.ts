const isPageTranslatedMap = new Map<number, boolean>()

export function translationMessage() {
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
}
