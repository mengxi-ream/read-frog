import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { SELECT_CONTENT_PROPS } from "./select-content-props"

function ActionIdentity({ action }: { action: SelectionToolbarCustomAction }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon icon={action.icon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{action.name}</span>
    </span>
  )
}

/**
 * Picks one AI action. Action names are the user's own, so the trigger is capped rather than
 * left to grow with whatever they named it.
 */
export function ActionSelect({
  actions,
  selected,
  label,
  onSelect,
}: {
  actions: SelectionToolbarCustomAction[]
  selected: SelectionToolbarCustomAction
  label: string
  onSelect: (actionId: string) => void
}) {
  return (
    <Select
      value={selected.id}
      onValueChange={(actionId) => {
        if (actionId) onSelect(actionId)
      }}
    >
      <SelectTrigger size="sm" className="max-w-60" aria-label={label}>
        <SelectValue render={<span className="min-w-0 flex-1" />}>
          <ActionIdentity action={selected} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {actions.map((action) => (
            <SelectItem key={action.id} value={action.id}>
              <ActionIdentity action={action} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
