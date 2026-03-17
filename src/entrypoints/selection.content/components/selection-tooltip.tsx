import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { cn } from "@/utils/styles/utils"
import { shadowWrapper } from ".."
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "../overlay-layers"

interface SelectionTooltipProps extends Pick<React.ComponentProps<typeof Tooltip>, "open" | "onOpenChange">,
  Pick<React.ComponentProps<typeof TooltipContent>, "align" | "alignOffset" | "className" | "side" | "sideOffset"> {
  children?: ReactNode
  content: ReactNode
  render: React.ReactElement
  container?: React.ComponentProps<typeof TooltipContent>["container"]
  positionerClassName?: string
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
        className={cn("whitespace-nowrap", className)}
        container={container}
        positionerClassName={positionerClassName}
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
