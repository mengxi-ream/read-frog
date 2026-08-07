import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function TranslationHubShortcut() {
  const [translationHub, setTranslationHub] = useAtom(configFieldsAtomMap.translationHub)

  return (
    <ShortcutConfigItem
      id="translation-hub-shortcut"
      title={i18n.t("options.shortcuts.translationHub.title")}
      description={i18n.t("options.shortcuts.translationHub.description")}
      shortcut={translationHub.shortcut}
      onChange={(nextShortcut) => {
        void setTranslationHub({ shortcut: nextShortcut })
      }}
    />
  )
}
