import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSpeakShortcut } from "@/utils/constants/selection"
import { i18n } from "@/utils/i18n"
import { buildSectionSearch } from "../../command-palette/section-scroll"
import { ShortcutConfigItem } from "./shortcut-config-item"
import { TurnOnButton } from "./turn-on-button"

export function SelectionSpeakShortcut() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { speak } = selectionToolbar.features

  return (
    <ShortcutConfigItem
      id="selection-speak-shortcut"
      title={
        <span className="flex items-center gap-2">
          {i18n.t("options.shortcuts.selectionSpeak.title")}
          {!speak.enabled && (
            <TurnOnButton
              to={{
                pathname: "/selection-toolbar",
                search: buildSectionSearch("selection-toolbar-speak"),
              }}
            />
          )}
        </span>
      }
      description={i18n.t("options.shortcuts.selectionSpeak.description")}
      shortcut={getSpeakShortcut(speak)}
      onChange={(nextShortcut) => {
        void setSelectionToolbar((current) => ({
          ...current,
          features: {
            ...current.features,
            speak: { ...current.features.speak, shortcut: nextShortcut },
          },
        }))
      }}
    />
  )
}
