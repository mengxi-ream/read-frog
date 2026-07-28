import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSelectionToolbarActions, resolveSaveSuggestionAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

const ACTION_SELECT_ID = "selection-toolbar-save-suggestion-action"

function ActionIdentity({ action }: { action: SelectionToolbarCustomAction }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon icon={action.icon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{action.name}</span>
    </span>
  )
}

export function SelectionToolbarSaveSuggestionToggle() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const actions = getSelectionToolbarActions(selectionToolbar)
  const selectedAction = resolveSaveSuggestionAction(selectionToolbar)

  return (
    <ConfigCard
      id="selection-toolbar-save-suggestion"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.saveSuggestion.title")}
      description={i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.saveSuggestion.description",
      )}
    >
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full justify-end">
          <Switch
            checked={selectionToolbar.saveSuggestion.enabled}
            onCheckedChange={(checked) =>
              void setSelectionToolbar({
                ...selectionToolbar,
                saveSuggestion: { ...selectionToolbar.saveSuggestion, enabled: checked },
              })
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ACTION_SELECT_ID} className="text-sm font-medium">
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.saveSuggestion.action")}
          </label>
          <Select
            value={selectedAction.id}
            onValueChange={(actionId) => {
              if (!actionId) return
              void setSelectionToolbar({
                ...selectionToolbar,
                saveSuggestion: { ...selectionToolbar.saveSuggestion, actionId },
              })
            }}
          >
            <SelectTrigger id={ACTION_SELECT_ID} className="w-full">
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
        </div>
      </div>
    </ConfigCard>
  )
}
