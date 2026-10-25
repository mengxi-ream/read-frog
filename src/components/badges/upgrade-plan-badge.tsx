import type { ComponentProps } from "react"
import type { HostedAiUpgradePlan } from "@/utils/hosted-ai/types"
import { i18n } from "@/utils/i18n"
import { PlanBadge } from "./plan-badge"

// Any plan above the one named works too, so the Pro tooltip says so.
const UPGRADE_TOOLTIP_KEYS = {
  pro: "hostedAi.planBadge.pro",
  ultra: "hostedAi.planBadge.ultra",
} as const satisfies Record<HostedAiUpgradePlan, string>

/**
 * The plan an account lacks for a Built-in AI option: a badge with the plan's
 * name that leads to pricing. The server decides which plan, if any (the
 * tier's `upgradeTo`), so an account that can already run the option gets none.
 */
export function UpgradePlanBadge({
  plan,
  tooltipContainer,
}: {
  plan: HostedAiUpgradePlan
  tooltipContainer?: ComponentProps<typeof PlanBadge>["tooltipContainer"]
}) {
  return (
    <PlanBadge
      plan={plan}
      upgradeTooltip={i18n.t(UPGRADE_TOOLTIP_KEYS[plan])}
      tooltipContainer={tooltipContainer}
    />
  )
}
