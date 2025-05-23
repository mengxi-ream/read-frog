import type { Config } from '@/types/config/config'
import { CONFIG_STORAGE_KEY } from '@/utils/constants/config'
import { OFFICIAL_SITE_URL_PATTERNS } from '@/utils/constants/site'

let lastIsPinned = false

export function newUserGuide() {
  guidePinExtension()
  guideSetTargetLanguage()
}

export async function guidePinExtension() {
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

export async function guideSetTargetLanguage() {
  onMessage('setTargetLanguage', async (msg) => {
    logger.log('setTargetLanguage', msg)
    const { langCodeISO6393 } = msg.data
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
    if (!config)
      return
    await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
      ...config,
      language: {
        ...config.language,
        targetCode: langCodeISO6393,
      },
    })
  })
}
