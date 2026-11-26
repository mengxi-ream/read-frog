import { createLogger } from "@/utils/logging/logger"
import { orpcClient } from "@/utils/orpc/client"

const log = createLogger("hosted-ai/upgrade-plan")

/** A plan with a bigger one above it. */
export type BuiltInAiUpgradePlan = "free" | "pro"

/**
 * Long enough that a page of paragraphs refused one after another asks once, short
 * enough that someone who just upgraded is not told about a plan they left.
 */
const PLAN_TTL_MS = 60_000

let cachedPlan: { plan: BuiltInAiUpgradePlan | null; readAt: number } | null = null
let inflightPlan: Promise<BuiltInAiUpgradePlan | null> | null = null

/**
 * The plan of an account whose pool is spent, for the upgrade it is offered, or null when
 * it is on Ultra: nothing sits above Ultra, so it is offered no upgrade and its caller
 * keeps its own message. A plan that can't be read counts as Free, since nearly everyone
 * who runs dry is on Free.
 *
 * Kept for a minute and shared by everyone in this frame who asks meanwhile: a refusal
 * can arrive once per paragraph or cue batch, and each would otherwise read it again.
 */
export function getBuiltInAiUpgradePlan(): Promise<BuiltInAiUpgradePlan | null> {
  if (cachedPlan && Date.now() - cachedPlan.readAt < PLAN_TTL_MS) {
    return Promise.resolve(cachedPlan.plan)
  }

  inflightPlan ??= (async () => {
    let plan: BuiltInAiUpgradePlan | null
    try {
      const status = await orpcClient.billing.status()
      plan = status.plan === "ultra" ? null : status.plan
    } catch (error) {
      log.warn("Could not read the plan for the upgrade prompt", { error })
      plan = "free"
    }
    cachedPlan = { plan, readAt: Date.now() }
    inflightPlan = null
    return plan
  })()
  return inflightPlan
}

/** Tests only: forget the plan read so far. */
export function resetBuiltInAiUpgradePlanCache(): void {
  cachedPlan = null
  inflightPlan = null
}
