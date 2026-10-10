import { useAtomValue, useSetAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { getSelectionToolbarActions, resolveWordLookupAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { ActionIdentity } from "../../../components/action-identity"
import { ConfigItem } from "../../../components/config-item"

export function WordLookupActionItem() {
  const config = useAtomValue(configAtom)
  const setWordLookup = useSetAtom(configFieldsAtomMap.wordLookup)
  const actions = getSelectionToolbarActions(config.selectionToolbar)
  const selectedAction = resolveWordLookupAction(config)

  return (
    <ConfigItem
      id="subtitles-word-lookup-action"
      title={i18n.t("options.videoSubtitles.preference.wordLookupAction.title")}
      description={i18n.t("options.videoSubtitles.preference.wordLookupAction.description")}
    >
      <Select
        value={selectedAction.id}
        onValueChange={(actionId) => {
          if (!actionId) return
          void setWordLookup({ actionId })
        }}
      >
        <SelectTrigger
          size="sm"
          className="max-w-60"
          aria-label={i18n.t("options.videoSubtitles.preference.wordLookupAction.title")}
        >
          <SelectValue render={<span className="min-w-0 flex-1" />}>
            <ActionIdentity action={selectedAction} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {actions.map((action) => (
              <SelectItem key={action.id} value={action.id}>
                <ActionIdentity action={action} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigItem>
  )
}
