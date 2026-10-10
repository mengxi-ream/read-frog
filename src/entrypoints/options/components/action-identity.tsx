import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"

export function ActionIdentity({ action }: { action: SelectionToolbarCustomAction }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon icon={action.icon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{action.name}</span>
    </span>
  )
}
