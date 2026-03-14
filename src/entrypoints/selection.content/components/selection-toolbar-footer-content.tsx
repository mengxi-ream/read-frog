import type { ProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { IconRefresh } from "@tabler/icons-react"
import { useCallback, useState } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { SelectionPopover, useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"

const TOOLTIP_TRIGGER_PRESS_REASON = "trigger-press"

export function RegenerateButton({
  className,
  onRegenerate,
}: {
  className?: string
  onRegenerate: () => void
}) {
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const handleClick = useCallback(() => {
    setTooltipOpen(true)
    onRegenerate()
  }, [onRegenerate])

  const handleTooltipOpenChange = useCallback((nextOpen: boolean, eventDetails: { reason: string }) => {
    if (!nextOpen && eventDetails.reason === TOOLTIP_TRIGGER_PRESS_REASON) {
      return
    }

    setTooltipOpen(nextOpen)
  }, [])

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
      <TooltipTrigger
        render={(
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }), className)}
            onClick={handleClick}
            aria-label={i18n.t("action.regenerate")}
            title={i18n.t("action.regenerate")}
          />
        )}
      >
        <IconRefresh />
      </TooltipTrigger>
      <TooltipContent
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
      >
        {i18n.t("action.regenerate")}
      </TooltipContent>
    </Tooltip>
  )
}

export function SelectionToolbarFooterContent({
  className,
  onProviderChange,
  onRegenerate,
  providers,
  value,
}: {
  className?: string
  onProviderChange: (id: string) => void
  onRegenerate: () => void
  providers: ProviderConfig[]
  value: string
}) {
  const popoverOverlay = useSelectionPopoverOverlayProps()

  return (
    <SelectionPopover.Footer className={cn("justify-between gap-3 border-t", className)}>
      <div className="min-w-0 max-w-52 flex-1">
        <ProviderSelector
          providers={providers}
          value={value}
          onChange={onProviderChange}
          className="max-w-60"
          selectContentProps={popoverOverlay}
        />
      </div>
      <RegenerateButton onRegenerate={onRegenerate} />
    </SelectionPopover.Footer>
  )
}
