import type { GuideDictionaryNotebaseCompletionInput } from "@/utils/guide/dictionary-notebase"
import { browser } from "#imports"
import { env } from "@/env"
import { markGuideDictionaryNotebaseCompleted } from "@/utils/guide/dictionary-notebase"
import { createLogger } from "@/utils/logging/logger"
import { onMessage, sendMessage } from "@/utils/message"

const log = createLogger("background/new-user-guide")

let lastIsPinned = false

export function newUserGuide() {
  void guidePinExtension()
  guideDictionaryNotebase()
}

export async function guidePinExtension() {
  onMessage("getPinState", async () => {
    const { isOnToolbar } = await browser.action.getUserSettings()
    return isOnToolbar
  })

  void checkPinnedAndNotify()

  if (browser.action.onUserSettingsChanged) {
    browser.action.onUserSettingsChanged.addListener(checkPinnedAndNotify)
  } else {
    setInterval(checkPinnedAndNotify, 1_000)
  }
}

async function checkPinnedAndNotify() {
  const { isOnToolbar } = await browser.action.getUserSettings()
  if (isOnToolbar === lastIsPinned) return
  lastIsPinned = isOnToolbar

  browser.tabs.query(
    { url: env.WXT_OFFICIAL_SITE_ORIGINS.map((origin: string) => `${origin}/*`) },
    (tabs) => {
      for (const tab of tabs) {
        void sendMessage("pinStateChanged", { isPinned: isOnToolbar }, tab.id).catch((error) => {
          log.warn("Failed to notify pin state", { error })
        })
      }
    },
  )
}

export async function completeGuideDictionaryNotebaseAndNotify(
  completion: GuideDictionaryNotebaseCompletionInput,
) {
  const state = await markGuideDictionaryNotebaseCompleted(completion)

  await notifyGuideDictionaryNotebaseStateChanged(state)
}

function guideDictionaryNotebase() {
  onMessage("completeGuideDictionaryNotebase", async (message) => {
    await completeGuideDictionaryNotebaseAndNotify(message.data)
  })
}

async function notifyGuideDictionaryNotebaseStateChanged(state: { completed: boolean }) {
  const tabs = await browser.tabs.query({
    url: env.WXT_OFFICIAL_SITE_ORIGINS.map((origin: string) => `${origin}/*`),
  })

  for (const tab of tabs) {
    if (!tab.id) {
      continue
    }

    void sendMessage("guideDictionaryNotebaseStateChanged", state, tab.id).catch((error) => {
      log.warn("Failed to notify guide dictionary Notebase state", { error })
    })
  }
}
