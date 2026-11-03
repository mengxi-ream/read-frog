import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getDifficultWordsShortcut } from "@/utils/constants/difficult-words"
import { i18n } from "@/utils/i18n"
import { buildSectionLink } from "../../command-palette/section-scroll"
import { DIFFICULT_WORDS_ROUTE, useIsDifficultWordsOpen } from "../difficult-words/access"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function DifficultWordsShortcut() {
  const [difficultWords, setDifficultWords] = useAtom(configFieldsAtomMap.difficultWords)
  const isOpen = useIsDifficultWordsOpen()
  if (!isOpen) return null

  return (
    <ShortcutConfigItem
      id="difficult-words-shortcut"
      title={i18n.t("options.shortcuts.difficultWords.title")}
      description={i18n.t("options.shortcuts.difficultWords.description")}
      turnOn={
        difficultWords.enabled
          ? undefined
          : buildSectionLink(DIFFICULT_WORDS_ROUTE, "difficult-words-enable")
      }
      shortcut={getDifficultWordsShortcut(difficultWords)}
      onChange={(shortcut) => {
        void setDifficultWords({ shortcut })
      }}
    />
  )
}
