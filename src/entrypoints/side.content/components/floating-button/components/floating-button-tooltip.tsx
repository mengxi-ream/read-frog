import type { ReactElement, ReactNode } from "react"
import type { FloatingButtonSide } from "@/types/config/floating-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { shadowWrapper } from "../../.."

interface FloatingButtonTooltipProps extends Pick<
  React.ComponentProps<typeof Tooltip>,
  "onOpenChange" | "open"
> {
  children?: ReactNode
  content: ReactNode
  render: ReactElement
  side: FloatingButtonSide
}

export function FloatingButtonTooltip({
  children,
  content,
  onOpenChange,
  open,
  render,
  side,
}: FloatingButtonTooltipProps) {
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger render={render}>{children}</TooltipTrigger>
      <TooltipContent
        container={shadowWrapper ?? document.body}
        side={side === "right" ? "left" : "right"}
        sideOffset={8}
        className="notranslate pointer-events-none whitespace-nowrap"
        positionerClassName="pointer-events-none"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
