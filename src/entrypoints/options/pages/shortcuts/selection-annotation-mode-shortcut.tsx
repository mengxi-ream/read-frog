import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAnnotationModeShortcut } from "@/utils/constants/selection"
import { i18n } from "@/utils/i18n"
import { buildSectionLink } from "../../command-palette/section-scroll"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function SelectionAnnotationModeShortcut() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { annotation } = selectionToolbar

  return (
    <ShortcutConfigItem
      id="selection-annotation-mode-shortcut"
      title={i18n.t("options.shortcuts.selectionAnnotationMode.title")}
      description={i18n.t("options.shortcuts.selectionAnnotationMode.description")}
      turnOn={
        annotation.enabled
          ? undefined
          : buildSectionLink("/selection-toolbar", "selection-toolbar-annotation-enable")
      }
      shortcut={getAnnotationModeShortcut(annotation)}
      onChange={(nextShortcut) => {
        void setSelectionToolbar((current) => ({
          ...current,
          annotation: { ...current.annotation, modeShortcut: nextShortcut },
        }))
      }}
    />
  )
}
