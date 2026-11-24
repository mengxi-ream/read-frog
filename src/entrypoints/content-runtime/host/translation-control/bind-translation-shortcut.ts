import type { HotkeyChord } from "@tanstack/hotkeys"
import type { PageTranslationManager } from "./page-translation"
import { HotkeyManager } from "@tanstack/hotkeys"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import { isFeatureOn } from "@/utils/features"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"

/**
 * Binds page translation shortcut key from the given config. With page translation switched
 * off in simple mode the key is left to the page; switched off after this, the manager turns
 * a start down itself.
 */
export async function bindTranslationShortcutKey(pageTranslationManager: PageTranslationManager) {
  const config = await getLocalConfig()
  if (
    !config ||
    !isFeatureOn(config, "pageTranslation") ||
    isShortcutEmpty(config.pageTranslation.page.shortcut)
  ) {
    return () => {}
  }

  const shortcut = config.pageTranslation.page.shortcut
  if (!isValidShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as HotkeyChord,
    () => {
      if (pageTranslationManager.isActive) {
        pageTranslationManager.stop({ userInitiated: true })
      } else {
        void pageTranslationManager.start(
          createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.SHORTCUT),
        )
      }
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
