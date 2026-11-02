import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAnnotationShortcut } from "@/utils/constants/selection"
import { i18n } from "@/utils/i18n"
import { buildSectionLink } from "../../command-palette/section-scroll"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function SelectionAnnotationShortcut() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { annotation } = selectionToolbar

  return (
    <ShortcutConfigItem
      id="selection-annotation-shortcut"
      title={i18n.t("options.shortcuts.selectionAnnotation.title")}
      description={i18n.t("options.shortcuts.selectionAnnotation.description")}
      turnOn={
        annotation.enabled
          ? undefined
          : buildSectionLink("/selection-toolbar", "selection-toolbar-annotation-enable")
      }
      shortcut={getAnnotationShortcut(annotation)}
      onChange={(nextShortcut) => {
        void setSelectionToolbar((current) => ({
          ...current,
          annotation: { ...current.annotation, shortcut: nextShortcut },
        }))
      }}
    />
  )
}
