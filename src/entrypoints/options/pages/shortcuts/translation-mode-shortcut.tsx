import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function TranslationModeShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <ShortcutConfigItem
      id="translation-mode-shortcut"
      title={i18n.t("options.shortcuts.translationMode.title")}
      description={i18n.t("options.shortcuts.translationMode.description")}
      shortcut={translateConfig.modeShortcut ?? ""}
      onChange={(nextShortcut) => {
        void setTranslateConfig({
          ...translateConfig,
          modeShortcut: nextShortcut,
        })
      }}
    />
  )
}
