import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
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
import {
  getLookupActionChoices,
  resolveClickLookupAction,
  resolveDragLookupAction,
} from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { ActionIdentity } from "../../../components/action-identity"
import { ConfigItem } from "../../../components/config-item"

function LookupActionItem({
  id,
  title,
  description,
  actions,
  selectedAction,
  onSelect,
}: {
  id: string
  title: string
  description: string
  actions: SelectionToolbarCustomAction[]
  selectedAction: SelectionToolbarCustomAction
  onSelect: (actionId: string) => void
}) {
  return (
    <ConfigItem id={id} title={title} description={description}>
      <Select
        value={selectedAction.id}
        onValueChange={(actionId) => {
          if (actionId) onSelect(actionId)
        }}
      >
        <SelectTrigger size="sm" className="max-w-60" aria-label={title}>
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

export function WordLookupActionItems() {
  const config = useAtomValue(configAtom)
  const setWordLookup = useSetAtom(configFieldsAtomMap.wordLookup)
  const clickAction = resolveClickLookupAction(config)
  const dragAction = resolveDragLookupAction(config)

  return (
    <>
      <LookupActionItem
        id="subtitles-click-lookup-action"
        title={i18n.t("options.videoSubtitles.preference.clickLookupAction.title")}
        description={i18n.t("options.videoSubtitles.preference.clickLookupAction.description")}
        actions={getLookupActionChoices(config.selectionToolbar, clickAction.id)}
        selectedAction={clickAction}
        onSelect={(clickActionId) => void setWordLookup({ clickActionId })}
      />
      <LookupActionItem
        id="subtitles-drag-lookup-action"
        title={i18n.t("options.videoSubtitles.preference.dragLookupAction.title")}
        description={i18n.t("options.videoSubtitles.preference.dragLookupAction.description")}
        actions={getLookupActionChoices(config.selectionToolbar, dragAction.id)}
        selectedAction={dragAction}
        onSelect={(dragActionId) => void setWordLookup({ dragActionId })}
      />
    </>
  )
}
