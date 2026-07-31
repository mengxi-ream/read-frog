import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function SelectionTranslationShortcut() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const shortcut =
    selectionToolbar.features.translate.shortcut ?? DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY

  return (
    <ShortcutConfigItem
      id="selection-translation-shortcut"
      title={i18n.t("options.shortcuts.selectionTranslation.title")}
      description={i18n.t("options.shortcuts.selectionTranslation.description")}
      shortcut={shortcut}
      onChange={(nextShortcut) => {
        void setSelectionToolbar({
          ...selectionToolbar,
          features: {
            ...selectionToolbar.features,
            translate: {
              ...selectionToolbar.features.translate,
              shortcut: nextShortcut,
            },
          },
        })
      }}
    />
  )
}
