import type {
  AnalyticsFeature,
  FeatureUsageContext,
  FeatureUsedEventProperties,
  SurfaceByFeature,
} from "@/types/analytics"
import { ANALYTICS_FEATURE_USED_EVENT } from "@/utils/constants/analytics"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"

type WithTiming<T> = T extends unknown
  ? Omit<T, "latency_ms"> & { startedAt: number; finishedAt?: number }
  : never
type WithoutOutcome<T> = T extends unknown ? Omit<T, "outcome" | "finishedAt"> : never

export type FeatureUsedEventInput = WithTiming<FeatureUsedEventProperties>

/** Everything `trackFeatureUsed` needs except the outcome, which the attempt decides. */
export type FeatureAttemptInput = WithoutOutcome<FeatureUsedEventInput>

export function createFeatureUsageContext<F extends AnalyticsFeature>(
  feature: F,
  surface: SurfaceByFeature[NoInfer<F>],
  startedAt = Date.now(),
): FeatureUsageContext<F> {
  return {
    feature,
    surface,
    startedAt,
  }
}

export function getLatencyMs(startedAt: number, finishedAt = Date.now()): number {
  return Math.max(0, finishedAt - startedAt)
}

export function buildFeatureUsedEventProperties(
  input: FeatureUsedEventInput,
): FeatureUsedEventProperties {
  const { startedAt, finishedAt = Date.now(), ...properties } = input
  return {
    ...properties,
    latency_ms: getLatencyMs(startedAt, finishedAt),
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
