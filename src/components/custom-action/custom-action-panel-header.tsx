import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SelectionToolbarTitleContent } from "@/components/ui/selection-popover/selection-toolbar-title-content"

export function CustomActionPanelHeader({
  action,
}: {
  action: SelectionToolbarCustomAction | null
}) {
  return (
    <SelectionPopover.Header className="border-b">
      <SelectionToolbarTitleContent
        title={action?.name ?? "Custom Action"}
        icon={action?.icon ?? "tabler:sparkles"}
      />
      <div className="flex items-center gap-1">
        <SelectionPopover.Pin />
        <SelectionPopover.Close />
      </div>
    </SelectionPopover.Header>
  )
}
