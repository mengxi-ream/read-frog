import type {
  AnalyticsOutcome,
  AnalyticsSurface,
  FeatureProviderAnalytics,
  FeatureUsageContext,
  FeatureUsedEventProperties,
  TranslationBackendKind,
  TranslationConfiguredPrompt,
  TranslationRequestedFeature,
  TranslationRequestedInput,
} from "@/types/analytics"
import type { ProviderConfig } from "@/types/config/provider"
import { isLLMProviderConfig } from "@/types/config/provider"
import { ANALYTICS_FEATURE_USED_EVENT } from "@/utils/constants/analytics"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"

export interface FeatureUsedEventInput extends FeatureUsageContext, FeatureProviderAnalytics {
  outcome: AnalyticsOutcome
  finishedAt?: number
}

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

export function classifyTranslationRequest(
  providerConfig: ProviderConfig | null | undefined,
  promptId: string | null | undefined,
): Pick<TranslationRequestedInput, "backend_kind" | "configured_prompt"> {
  if (!providerConfig) {
    return {
      backend_kind: "unknown",
      configured_prompt: "unknown",
    }
  }

  if (!isLLMProviderConfig(providerConfig)) {
    return {
      backend_kind: "non_llm",
      configured_prompt: "not_applicable",
    }
  }

  return {
    backend_kind: "llm",
    configured_prompt: promptId === null ? "default" : "custom",
  }
}

export async function trackTranslationRequested(input: {
  feature: TranslationRequestedFeature
  surface: AnalyticsSurface
  backend_kind: TranslationBackendKind
  configured_prompt: TranslationConfiguredPrompt
}): Promise<void> {
  try {
    await sendMessage("trackTranslationRequestedEvent", input)
  } catch (error) {
    if (typeof logger.warn === "function") {
      logger.warn("[Analytics] Failed to track translation_requested", error)
    }
  }
}

export async function trackFeatureAttempt<T>(
  context: FeatureUsageContext & FeatureProviderAnalytics,
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
