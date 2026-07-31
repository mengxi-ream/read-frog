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
import { ConfigItem } from "../../../components/config-item"

function ActionIdentity({ action }: { action: SelectionToolbarCustomAction }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon icon={action.icon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{action.name}</span>
    </span>
  )
}

/**
 * Whether translating a selection offers to save what it found, and which action does the
 * finding. The second row goes untitled: it only exists for the switch above it, and reads as
 * a continuation of it rather than a setting of its own.
 */
export function SaveSuggestionItems() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const actions = getSelectionToolbarActions(selectionToolbar)
  const selectedAction = resolveSaveSuggestionAction(selectionToolbar)

  return (
    <>
      <ConfigItem
        id="selection-toolbar-save-suggestion"
        title={i18n.t("options.selectionToolbar.actions.saveSuggestion.title")}
        description={i18n.t("options.selectionToolbar.actions.saveSuggestion.description")}
      >
        <Switch
          checked={selectionToolbar.saveSuggestion.enabled}
          onCheckedChange={(checked) =>
            void setSelectionToolbar({
              ...selectionToolbar,
              saveSuggestion: { ...selectionToolbar.saveSuggestion, enabled: checked },
            })
          }
        />
      </ConfigItem>
      <ConfigItem
        description={i18n.t("options.selectionToolbar.actions.saveSuggestion.actionDescription")}
      >
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
          {/* Action names are the user's own, so the trigger is capped rather than left to
              grow with whatever they named it. The row carries no title, so the control
              names itself. */}
          <SelectTrigger
            size="sm"
            className="max-w-60"
            aria-label={i18n.t("options.selectionToolbar.actions.saveSuggestion.action")}
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
    </>
  )
}
