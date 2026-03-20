import type { Hotkey } from "@tanstack/hotkeys"
import type { PageTranslationManager } from "./page-translation"
import { HotkeyManager } from "@tanstack/hotkeys"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import { isPageTranslationShortcutEmpty, isValidConfiguredPageTranslationShortcut } from "@/utils/page-translation-shortcut"

/**
 * Binds page translation shortcut key from the given config.
 * Uses sync cached config inside the hotkey callback to avoid async overhead.
 */
export async function bindTranslationShortcutKey(pageTranslationManager: PageTranslationManager) {
  const config = await getLocalConfig()
  if (!config || isPageTranslationShortcutEmpty(config.translate.page.shortcut)) {
    return () => {}
  }

  const shortcut = config.translate.page.shortcut
  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    () => {
      if (pageTranslationManager.isActive) {
        pageTranslationManager.stop()
      }
      else {
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
