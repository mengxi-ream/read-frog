import { useAtom } from "jotai"
import { i18n } from "#imports"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY } from "@/utils/constants/translate"
import { ConfigCard } from "../../components/config-card"

export function SelectionTranslationShortcut() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const shortcut = selectionToolbar.features.translate.shortcut ?? DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY

  const updateShortcut = (shortcut: string) => {
    void setSelectionToolbar({
      ...selectionToolbar,
      features: {
        ...selectionToolbar.features,
        translate: {
          ...selectionToolbar.features.translate,
          shortcut,
        },
      },
    })
  }

  return (
    <ConfigCard
      id="selection-translation-shortcut"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.shortcut.title")}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.shortcut.description")}
    >
      <ShortcutKeyRecorder shortcutKey={shortcut} onChange={updateShortcut} />
    </ConfigCard>
  )
}
