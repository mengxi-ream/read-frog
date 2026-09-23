import type {
  AnalyticsOutcome,
  AnalyticsSurface,
  FeatureProviderAnalytics,
  FeatureUsageContext,
  FeatureUsedEventProperties,
} from "@/types/analytics"
import { ANALYTICS_FEATURE_USED_EVENT } from "@/utils/constants/analytics"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"

export interface FeatureUsedEventInput extends FeatureUsageContext, FeatureProviderAnalytics {
  outcome: AnalyticsOutcome
  finishedAt?: number
  /**
   * Measured on the input of this one use, so it is passed when the use is reported
   * rather than carried on the usage context. Only text translation features set it.
   */
  char_count?: number
}

/** Everything `trackFeatureUsed` needs except the outcome, which the attempt decides. */
export type FeatureAttemptInput = Omit<FeatureUsedEventInput, "outcome" | "finishedAt">

export function createFeatureUsageContext(
  feature: FeatureUsageContext["feature"],
  surface: AnalyticsSurface,
  startedAt = Date.now(),
  metadata?: Pick<FeatureUsageContext, "action_id" | "action_name">,
): FeatureUsageContext {
  return {
    feature,
    surface,
    startedAt,
    ...metadata,
  }
}

export function getLatencyMs(startedAt: number, finishedAt = Date.now()): number {
  return Math.max(0, finishedAt - startedAt)
}

export function buildFeatureUsedEventProperties({
  feature,
  surface,
  outcome,
  startedAt,
  finishedAt = Date.now(),
  action_id,
  action_name,
  char_count,
  provider,
  backend_kind,
}: FeatureUsedEventInput): FeatureUsedEventProperties {
  return {
    feature,
    surface,
    outcome,
    latency_ms: getLatencyMs(startedAt, finishedAt),
    provider,
    backend_kind,
    ...(action_id !== undefined ? { action_id } : {}),
    ...(action_name !== undefined ? { action_name } : {}),
    ...(char_count !== undefined ? { char_count } : {}),
  }
}

export async function trackFeatureUsed(input: FeatureUsedEventInput): Promise<void> {
  try {
    await sendMessage("trackFeatureUsedEvent", buildFeatureUsedEventProperties(input))
  } catch (error) {
    if (typeof logger.warn === "function") {
      logger.warn(`[Analytics] Failed to track ${ANALYTICS_FEATURE_USED_EVENT}`, error)
    }
  }
}

export async function trackFeatureAttempt<T>(
  context: FeatureAttemptInput,
  run: () => Promise<T>,
): Promise<T> {
  try {
    const result = await run()
    void trackFeatureUsed({
      ...context,
      outcome: "success",
    })
    return result
  } catch (error) {
    void trackFeatureUsed({
      ...context,
      outcome: "failure",
    })
    throw error
  }
}
