import type { useRender } from "@base-ui/react/use-render"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import type { badgeVariants } from "@/components/ui/base-ui/badge"
import { Badge } from "@/components/ui/base-ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { env } from "@/env"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"

/** The billing plans, cheapest first. Mirrors the server's `billing.status.plan`. */
export const PLANS = ["free", "pro", "ultra"] as const

export type Plan = (typeof PLANS)[number]

/**
 * Plan names are brand names — identical in every locale — so they are literals
 * here rather than i18n keys. Anything explanatory belongs in `upgradeTooltip`.
 */
const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
}

/**
 * Carries the plan's tint, glow and rim gradient. The recipe itself lives in
 * theme.css, next to the glass physics it belongs to.
 */
const PLAN_GLASS: Record<Plan, string> = {
  free: "glass-badge-free",
  pro: "glass-badge-pro",
  ultra: "glass-badge-ultra",
}

type PlanBadgeProps = useRender.ComponentProps<"span"> &
  Pick<VariantProps<typeof badgeVariants>, "size"> & {
    plan: Plan
    /**
     * Turns the marker into an upgrade wall: the badge gains this tooltip and a
     * click through to pricing. Pass the localized explanation.
     *
     * Omit it for the "this account is on X" case. That one must stay inert: it
     * renders inside the account dropdown's own `<button>`, where a nested
     * button is invalid HTML and would eat the trigger's clicks.
     */
    upgradeTooltip?: string
    /**
     * Portal target for the tooltip. Pass it when rendering inside a shadow root
     * (e.g. the selection popover) so the tooltip lands where the extension's
     * styles reach.
     */
    tooltipContainer?: ComponentProps<typeof TooltipContent>["container"]
  }

/**
 * Marks a surface with a plan. Free reads as colourless glass, Pro as cool
 * blue, Ultra as the brand gold, so the three rank at a glance without reading
 * the word.
 *
 * Two jobs, one look: it names the plan an account is *on* (the account menus)
 * and the plan a feature *requires* (hosted-AI provider rows). The second is
 * the interactive one — see `upgradeTooltip`.
 */
export function PlanBadge({
  plan,
  size = "sm",
  className,
  upgradeTooltip,
  tooltipContainer,
  ...props
}: PlanBadgeProps) {
  if (upgradeTooltip === undefined) {
    return (
      <Badge variant="glass" size={size} className={cn(PLAN_GLASS[plan], className)} {...props}>
        {PLAN_LABEL[plan]}
      </Badge>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="glass"
            size={size}
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
            className={cn(PLAN_GLASS[plan], "pointer-events-auto cursor-pointer", className)}
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
            {...props}
          >
            {PLAN_LABEL[plan]}
          </Badge>
        }
      />
      <TooltipContent container={tooltipContainer}>{upgradeTooltip}</TooltipContent>
    </Tooltip>
  )
}
