import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { IconTool } from "@tabler/icons-react"
import { useCallback } from "react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import {
  SelectionPopoverTooltip,
  useSelectionTooltipState,
} from "../../components/selection-tooltip"

export function CustomActionToolButton({
  action,
  className,
}: {
  action: SelectionToolbarCustomAction
  className?: string
}) {
  const { handlePress, onOpenChange: handleTooltipOpenChange, open: tooltipOpen } = useSelectionTooltipState()
  const label = i18n.t("action.customizeCustomAction", [action.name])

  const handleClick = useCallback(() => {
    handlePress()
    void sendMessage("openOptionsPage", {
      route: `/custom-actions?actionId=${encodeURIComponent(action.id)}`,
    })
  }, [action.id, handlePress])

  return (
    <SelectionPopoverTooltip
      content={label}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={(
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }), className)}
          onClick={handleClick}
          aria-label={label}
          title={label}
        />
      )}
    >
      <IconTool />
    </SelectionPopoverTooltip>
  )
}
