import { useAtomValue, useSetAtom } from "jotai"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { getSelectionToolbarActions, resolveWordLookupAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { ActionSelect } from "../../../components/action-select"
import { ConfigItem } from "../../../components/config-item"

export function WordLookupActionItem() {
  const config = useAtomValue(configAtom)
  const setVideoSubtitlesConfig = useSetAtom(configFieldsAtomMap.videoSubtitles)
  const selectedAction = resolveWordLookupAction(config)
  // Every enabled action, plus the one in effect even when it is off.
  const choices = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.enabled !== false || action.id === selectedAction.id,
  )
  const title = i18n.t("options.videoSubtitles.preference.wordLookupAction.title")

  return (
    <ConfigItem
      id="subtitles-word-lookup-action"
      title={title}
      description={i18n.t("options.videoSubtitles.preference.wordLookupAction.description")}
    >
      <ActionSelect
        actions={choices}
        selected={selectedAction}
        label={title}
        onSelect={(wordLookupActionId) => void setVideoSubtitlesConfig({ wordLookupActionId })}
      />
    </ConfigItem>
  )
}
