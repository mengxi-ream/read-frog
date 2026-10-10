import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSpeakShortcut } from "@/utils/constants/selection"
import { i18n } from "@/utils/i18n"
import { ShortcutConfigItem } from "./shortcut-config-item"
import { TurnedOffNote } from "./turned-off-note"

export function SelectionSpeakShortcut() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { speak } = selectionToolbar.features

  return (
    <ShortcutConfigItem
      id="selection-speak-shortcut"
      title={i18n.t("options.shortcuts.selectionSpeak.title")}
      description={
        <>
          {i18n.t("options.shortcuts.selectionSpeak.description")}
          {!speak.enabled && <TurnedOffNote />}
        </>
      }
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
