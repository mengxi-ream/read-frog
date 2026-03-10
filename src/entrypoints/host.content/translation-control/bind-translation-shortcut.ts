import type { PageTranslationManager } from "./page-translation"
import type { Config } from "@/types/config/config"
import hotkeys from "hotkeys-js"

/**
 * Binds page translation shortcut key from the given config.
 * Uses sync cached config inside the hotkey callback to avoid async overhead.
 */
export function bindTranslationShortcutKey(config: Config, pageTranslationManager: PageTranslationManager) {
  // Clear all existing hotkeys first
  hotkeys.unbind()

  const shortcut = config.translate.page.shortcut.join("+")

  hotkeys(shortcut, () => {
    if (pageTranslationManager.isActive) {
      pageTranslationManager.stop()
    }
    else {
      void pageTranslationManager.start()
    }
    return false
  })
}
