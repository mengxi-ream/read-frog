import type { Hotkey } from "@tanstack/hotkeys"
import type { TranslationMode } from "@/types/config/translate"
import { HotkeyManager } from "@tanstack/hotkeys"
import { toast } from "sonner"
import { i18n } from "#imports"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { isPageTranslationShortcutEmpty, isValidConfiguredPageTranslationShortcut } from "@/utils/page-translation-shortcut"

const NEXT_MODE: Record<TranslationMode, TranslationMode> = {
  bilingual: "translationOnly",
  translationOnly: "bilingual",
}

export async function bindTranslationModeShortcutKey() {
  const config = await getLocalConfig()
  if (!config || isPageTranslationShortcutEmpty(config.translate.modeShortcut)) {
    return () => {}
  }

  const shortcut = config.translate.modeShortcut
  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    async () => {
      const currentConfig = await getLocalConfig()
      if (!currentConfig)
        return

      const currentMode = currentConfig.translate.mode
      const nextMode = NEXT_MODE[currentMode]
      await setLocalConfig({
        ...currentConfig,
        translate: {
          ...currentConfig.translate,
          mode: nextMode,
        },
      })

      const modeName = i18n.t(`options.translation.translationMode.mode.${nextMode}`)
      toast.info(i18n.t("options.translation.translationModeShortcut.switched", [modeName]))
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
