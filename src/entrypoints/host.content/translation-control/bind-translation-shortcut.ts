import type { PageTranslationManager } from "./page-translation"
import hotkeys from "hotkeys-js"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"

/**
 * Binds page translation shortcut key from the given config.
 * Uses sync cached config inside the hotkey callback to avoid async overhead.
 */
export async function bindTranslationShortcutKey(pageTranslationManager: PageTranslationManager) {
  // Clear all existing hotkeys first
  hotkeys.unbind()
  const config = await getLocalConfig()
  if (!config) {
    return
  }

  const shortcut = config.translate.page.shortcut.join("+")

  hotkeys(shortcut, () => {
    if (pageTranslationManager.isActive) {
      pageTranslationManager.stop()
    }
    else {
      void pageTranslationManager.start(
        createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.SHORTCUT),
      )
    }
    return false
  })
}
