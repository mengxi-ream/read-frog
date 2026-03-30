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
        // This wrapper is only for selection-content overlays. In this path we
        // observed two separate real-browser failures:
        // 1) hover-leave could land on the tooltip overlay itself, so the
        //    browser never considered the pointer fully "back on the page";
        // 2) even after Base UI set the tooltip to the closed state, the node
        //    could remain visually visible until unmount.
        //
        // This path keeps the popup mouse-transparent while open so
        // hover-leave cannot land on the tooltip itself and contaminate the
        // hover chain.
        className={cn("pointer-events-none whitespace-nowrap", className)}
        container={container}
        // The positioner is a separate overlay box around the popup. Making the
        // popup itself transparent is not enough if the pointer can still land
        // on this wrapper during hover leave.
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
