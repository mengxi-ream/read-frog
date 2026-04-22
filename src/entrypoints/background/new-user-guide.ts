import { browser } from "#imports"
import { env } from "@/env"
import { onMessage, sendMessage } from "@/utils/message"

let lastIsPinned = false

export function newUserGuide() {
  void guidePinExtension()
}

export async function guidePinExtension() {
  onMessage("getPinState", async () => {
    const { isOnToolbar } = await browser.action.getUserSettings()
    return isOnToolbar
  })

  void checkPinnedAndNotify()

  if (browser.action.onUserSettingsChanged) {
    browser.action.onUserSettingsChanged.addListener(checkPinnedAndNotify)
  }
  else {
    setInterval(checkPinnedAndNotify, 1_000)
  }
}

async function checkPinnedAndNotify() {
  const { isOnToolbar } = await browser.action.getUserSettings()
  if (isOnToolbar === lastIsPinned)
    return
  lastIsPinned = isOnToolbar

  browser.tabs.query({ url: env.WXT_OFFICIAL_SITE_ORIGINS.map((origin: string) => `${origin}/*`) }, (tabs) => {
    for (const tab of tabs) {
      void sendMessage("pinStateChanged", { isPinned: isOnToolbar }, tab.id)
    }
  })
}
