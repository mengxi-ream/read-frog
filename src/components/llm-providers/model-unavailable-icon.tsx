import type { ComponentProps } from "react"
import { IconAlertTriangle } from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { cn } from "@/utils/styles/utils"

/**
 * Marks a Built-in AI model that cannot run. The tooltip says why and names
 * models to switch to; the same text is the icon's accessible name, so a
 * screen reader reads the reason as part of the row or card it sits in.
 */
export function ModelUnavailableIcon({
  reason,
  className,
  tooltipContainer,
}: {
  reason: string
  className?: string
  /**
   * Portal target for the tooltip. Pass it when rendering inside a shadow root
   * (e.g. the selection popover) so the tooltip lands where the extension's
   * styles reach.
   */
  tooltipContainer?: ComponentProps<typeof TooltipContent>["container"]
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={reason}
            data-slot="model-unavailable-icon"
            // Not focusable: it sits inside a SelectItem (`role="option"`),
            // where a focusable descendant breaks the listbox's keyboard
            // navigation. pointer-events-auto keeps the tooltip working in a
            // disabled row, which sets pointer-events-none.
            className={cn("pointer-events-auto inline-flex shrink-0", className)}
          />
        }
      >
        {/* Important: a highlighted menu row recolours every descendant. */}
        <IconAlertTriangle aria-hidden className="size-4 text-warning!" />
      </TooltipTrigger>
      <TooltipContent container={tooltipContainer}>{reason}</TooltipContent>
    </Tooltip>
  )
}
