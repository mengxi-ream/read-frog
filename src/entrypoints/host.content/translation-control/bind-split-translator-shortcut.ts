import type { Hotkey } from "@tanstack/hotkeys"
import { HotkeyManager } from "@tanstack/hotkeys"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { isPageTranslationShortcutEmpty, isValidConfiguredPageTranslationShortcut } from "@/utils/page-translation-shortcut"

/**
 * Binds the configured Split Translator shortcut on host pages.
 */
export async function bindSplitTranslatorShortcutKey() {
  const config = await getLocalConfig()
  const shortcut = config?.translate.splitTranslator.shortcut
  if (!shortcut || isPageTranslationShortcutEmpty(shortcut)) {
    return () => {}
  }

  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    () => {
      void sendMessage("toggleSidePanel", undefined).catch((error) => {
        logger.error("Failed to toggle split translator from shortcut", error)
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
