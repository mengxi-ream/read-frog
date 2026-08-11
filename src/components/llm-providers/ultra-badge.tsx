import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { i18n } from "@/utils/i18n"

/**
 * The shared plan-requirement marker for hosted-AI surfaces (provider
 * dropdowns, built-in provider assignment rows). "Ultra" is the plan's brand
 * name, identical in every locale; the tooltip carries the localized
 * explanation. Pass `tooltipContainer` when rendering inside a shadow root
 * (e.g. the selection popover) so the tooltip portals where the extension's
 * styles reach.
 */
export function UltraBadge({
  tooltipContainer,
}: {
  tooltipContainer?: ComponentProps<typeof TooltipContent>["container"]
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            size="sm"
            // pointer-events-auto opts the badge back in when a disabled
            // SelectItem ancestor sets pointer-events-none, so the tooltip
            // still opens there. Safe: base-ui guards selection in the item's
            // own JS handlers (early-returns on `disabled`), the CSS is
            // cosmetic only.
            className="pointer-events-auto cursor-default bg-amber-500/15 text-amber-600 dark:text-amber-400"
          />
        }
      >
        Ultra
      </TooltipTrigger>
      <TooltipContent container={tooltipContainer}>
        {i18n.t("hostedAi.ultraBadge.tooltip")}
      </TooltipContent>
    </Tooltip>
  )
}
