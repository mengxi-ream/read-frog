import { OFFICIAL_SITE_URL_PATTERNS } from '@/utils/constants/site'

let lastIsPinned = false

export async function newUserGuide() {
  onMessage('getPinState', async () => {
    const { isOnToolbar } = await browser.action.getUserSettings()
    return isOnToolbar
  })

  checkPinnedAndNotify()

  if (browser.action.onUserSettingsChanged) {
    browser.action.onUserSettingsChanged.addListener(checkPinnedAndNotify)
  }
  else {
    setInterval(checkPinnedAndNotify, 5_000)
  }
}

async function checkPinnedAndNotify() {
  const { isOnToolbar } = await browser.action.getUserSettings() // Chrome 91+:contentReference[oaicite:0]{index=0}
  if (isOnToolbar === lastIsPinned)
    return
  lastIsPinned = isOnToolbar

  browser.tabs.query({ url: OFFICIAL_SITE_URL_PATTERNS }, (tabs) => {
    for (const tab of tabs) {
      sendMessage('pinStateChanged', { isPinned: isOnToolbar }, tab.id)
    }
  })
}
