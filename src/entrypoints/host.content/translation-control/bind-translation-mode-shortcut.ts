import type { Hotkey } from "@tanstack/hotkeys"
import type { TranslationMode } from "@/types/config/translate"
import { HotkeyManager } from "@tanstack/hotkeys"
import { toastManager } from "@/components/ui/base-ui/toast"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { i18n } from "@/utils/i18n"
import {
  isPageTranslationShortcutEmpty,
  isValidConfiguredPageTranslationShortcut,
} from "@/utils/page-translation-shortcut"
import { getTranslationOnlyBlockedReason } from "@/utils/providers/translation-only-gate"

const NEXT_MODE: Record<TranslationMode, TranslationMode> = {
  bilingual: "translationOnly",
  translationOnly: "bilingual",
}

export async function bindTranslationModeShortcutKey() {
  const config = await getLocalConfig()
  if (!config || isPageTranslationShortcutEmpty(config.pageTranslation.modeShortcut)) {
    return () => {}
  }

  const shortcut = config.pageTranslation.modeShortcut
  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    async () => {
      const currentConfig = await getLocalConfig()
      if (!currentConfig) return

      const currentMode = currentConfig.pageTranslation.mode
      const nextMode = NEXT_MODE[currentMode]

      // Entering translationOnly is blocked while the page-translate provider
      // has no markup support (translation-only-gate.ts) — keep the mode and
      // surface the reason instead.
      const blockedReason =
        nextMode === "translationOnly" ? getTranslationOnlyBlockedReason(currentConfig) : null
      if (blockedReason !== null) {
        toastManager.add({ type: "info", title: blockedReason })
        return
      }

      await setLocalConfig({
        ...currentConfig,
        pageTranslation: {
          ...currentConfig.pageTranslation,
          mode: nextMode,
        },
      })

      const modeName = i18n.t(`options.translation.preference.translationMode.mode.${nextMode}`)
      toastManager.add({
        type: "info",
        title: i18n.t("options.translation.preference.translationMode.switched", [modeName]),
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
