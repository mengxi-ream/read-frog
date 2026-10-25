import type { Hotkey } from "@tanstack/hotkeys"
import { HotkeyManager } from "@tanstack/hotkeys"
import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { TRANSLATION_HUB_PAGE_PATH } from "@/utils/constants/translation-hub"
import { sendMessage } from "@/utils/message"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

/**
 * Opens the Translation Hub from any page. A content script cannot create a
 * tab itself, so the background does it — the same `openPage` route the popup
 * button and the options sidebar link already use.
 */
export async function bindTranslationHubShortcutKey() {
  const config = await getLocalConfig()
  if (!config || isShortcutEmpty(config.translationHub.shortcut)) {
    return () => {}
  }

  const shortcut = config.translationHub.shortcut
  if (!isValidShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    () => {
      void sendMessage("openPage", {
        url: browser.runtime.getURL(TRANSLATION_HUB_PAGE_PATH),
        active: true,
      })
    },
    {
      ignoreInputs: true,
      preventDefault: true,
      stopPropagation: true,
    },
  )

  return () => {
    registration.unregister()
  }
}
