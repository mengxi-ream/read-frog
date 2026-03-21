import type { ReactNode } from "react"
import { useCallback, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"
import { shadowWrapper } from ".."
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "../overlay-layers"

const TOOLTIP_TRIGGER_PRESS_REASON = "trigger-press"

interface SelectionTooltipOpenChangeDetails {
  reason: string
}

interface SelectionTooltipProps extends Pick<React.ComponentProps<typeof Tooltip>, "open" | "onOpenChange">,
  Pick<React.ComponentProps<typeof TooltipContent>, "align" | "alignOffset" | "className" | "side" | "sideOffset"> {
  children?: ReactNode
  content: ReactNode
  render: React.ReactElement
  container?: React.ComponentProps<typeof TooltipContent>["container"]
  positionerClassName?: string
}

export function useSelectionTooltipState() {
  const [open, setOpen] = useState(false)

  const handlePress = useCallback(() => {
    setOpen(true)
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean, eventDetails: SelectionTooltipOpenChangeDetails) => {
    if (!nextOpen && eventDetails.reason === TOOLTIP_TRIGGER_PRESS_REASON) {
      return
    }

    setOpen(nextOpen)
  }, [])

  return {
    handlePress,
    onOpenChange: handleOpenChange,
    open,
  }
}

function SelectionTooltip({
  align,
  alignOffset,
  children,
  className,
  container,
  content,
  onOpenChange,
  open,
  positionerClassName,
  render,
  side,
  sideOffset,
}: SelectionTooltipProps) {
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger render={render}>
        {children}
      </TooltipTrigger>
      <TooltipContent
        align={align}
        alignOffset={alignOffset}
        // Base UI moves tooltips through a closed -> unmounted transition. In
        // the selection-content shadow DOM, we observed closed tooltips remain
        // visually visible unless the closed state is hidden explicitly.
        className={cn("data-closed:hidden data-closed:opacity-0 pointer-events-none whitespace-nowrap", className)}
        container={container}
        // Ignore pointer hits on the positioning wrapper too, otherwise moving
        // off the trigger can land on the tooltip overlay itself instead of the
        // underlying page, which dirties the hover-leave path in real browsers.
        positionerClassName={cn("pointer-events-none", positionerClassName)}
        side={side}
        sideOffset={sideOffset}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export function SelectionToolbarTooltip(props: Omit<SelectionTooltipProps, "container" | "positionerClassName">) {
  return (
    <SelectionTooltip
      container={shadowWrapper ?? document.body}
      positionerClassName={SELECTION_CONTENT_OVERLAY_LAYERS.popoverOverlay}
      {...props}
    />
  )
}

export function SelectionPopoverTooltip(props: Omit<SelectionTooltipProps, "container" | "positionerClassName">) {
  const popoverOverlay = useSelectionPopoverOverlayProps()

  return (
    <SelectionTooltip
      // Keep this workaround scoped to selection-content popovers. Shared
      // Tooltip primitives are also used by options/popup pages, which do not
      // need the same browser-specific close-state fix.
      container={popoverOverlay.container}
      positionerClassName={popoverOverlay.positionerClassName}
      {...props}
    />
  )
}
