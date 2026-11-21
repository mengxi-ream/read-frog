import type {
  AnalyticsFeature,
  BuiltInAiPromptActionEventProperties,
  BuiltInAiPromptEvent,
  BuiltInAiPromptShownEventProperties,
  FeatureUsageContext,
  FeatureUsedEventProperties,
  SurfaceByFeature,
} from "@/types/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import {
  ANALYTICS_BUILT_IN_AI_PROMPT_ACTION_EVENT,
  ANALYTICS_BUILT_IN_AI_PROMPT_SHOWN_EVENT,
  ANALYTICS_FEATURE_USED_EVENT,
} from "@/utils/constants/analytics"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"

const log = createLogger("analytics")

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
    log.warn(`Failed to track ${ANALYTICS_FEATURE_USED_EVENT}`, { error })
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
      failure_reason: classifyFailureReason(error),
    })
    throw error
  }
}

async function trackBuiltInAiPromptEvent(event: BuiltInAiPromptEvent): Promise<void> {
  try {
    await sendMessage("trackBuiltInAiPromptEvent", event)
  } catch (error) {
    log.warn(`Failed to track ${event.event}`, { error })
  }
}

/** Once per prompt: how many people hit the wall, by feature, and how it was put to them. */
export function trackBuiltInAiPromptShown(
  properties: BuiltInAiPromptShownEventProperties,
): Promise<void> {
  return trackBuiltInAiPromptEvent({ event: ANALYTICS_BUILT_IN_AI_PROMPT_SHOWN_EVENT, properties })
}

/** What they did about it: upgrade, log in, switch to machine translation, or close it. */
export function trackBuiltInAiPromptAction(
  properties: BuiltInAiPromptActionEventProperties,
): Promise<void> {
  return trackBuiltInAiPromptEvent({ event: ANALYTICS_BUILT_IN_AI_PROMPT_ACTION_EVENT, properties })
}
