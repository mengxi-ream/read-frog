import type { MouseEvent } from "react"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useCallback } from "react"
import { SelectionToolbarTooltip } from "../../components/selection-tooltip"
import { useSelectionCustomActionPopover } from "./provider"

export function SelectionToolbarCustomActionTrigger({ action }: { action: SelectionToolbarCustomAction }) {
  const { openToolbarCustomAction } = useSelectionCustomActionPopover()

  const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
    openToolbarCustomAction(action.id, event.currentTarget)
  }, [action.id, openToolbarCustomAction])

  return (
    <SelectionToolbarTooltip
      content={action.name}
      render={(
        <button
          type="button"
          aria-label={action.name}
          className="px-2 h-7 shrink-0 flex items-center justify-center hover:bg-accent cursor-pointer"
          onClick={handleClick}
        />
      )}
    >
      <Icon icon={action.icon} strokeWidth={0.8} className="size-4.5" />
    </SelectionToolbarTooltip>
  )
}
