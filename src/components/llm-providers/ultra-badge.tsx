import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { env } from "@/env"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"

/**
 * The shared plan-requirement marker for hosted-AI surfaces (provider
 * dropdowns, built-in provider assignment rows). "Ultra" is the plan's brand
 * name, identical in every locale; the tooltip carries the localized
 * explanation and the invitation to click. Pass `tooltipContainer` when
 * rendering inside a shadow root (e.g. the selection popover) so the tooltip
 * portals where the extension's styles reach.
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
            // A button, but deliberately not tabbable: the badge renders inside
            // a base-ui SelectItem (`role="option"`), and a focusable
            // descendant there breaks listbox keyboard navigation. Pointer
            // users get the affordance, keyboard users reach pricing from the
            // account menu instead.
            render={<button type="button" tabIndex={-1} />}
            // pointer-events-auto opts the badge back in when a disabled
            // SelectItem ancestor sets pointer-events-none, so the tooltip and
            // the click still work there — which is the case that matters most,
            // since a disabled row is exactly where someone learns they need
            // the plan. Safe: base-ui guards selection in the item's own JS
            // handlers (early-returns on `disabled`), the CSS is cosmetic only.
            className="pointer-events-auto cursor-pointer bg-amber-500/15 text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
            onClick={(event) => {
              // Both hosts read a click as "activate me": a SelectItem commits
              // the provider selection, and the assignment row's wrapping
              // <label> toggles its Switch. Neither is what clicking the plan
              // marker means, so stop the click before it reaches them.
              //
              // Only the click is stopped, never pointerdown: SelectItem's
              // pointerdown is what makes its mouseup handler bail out early
              // (`allowMouseSelectionRef`), and swallowing it pushes mouseup
              // down a branch that re-dispatches a synthetic click on the item
              // itself — which this handler would never see.
              event.preventDefault()
              event.stopPropagation()
              void sendMessage("openPage", {
                url: new URL("/pricing", env.WXT_WEBSITE_URL).toString(),
                active: true,
              })
            }}
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
