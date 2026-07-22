import type {
  AnalyticsBackendKind,
  AnalyticsProvider,
  FeatureProviderAnalytics,
} from "@/types/analytics"
import type { ProviderConfig } from "@/types/config/provider"
import type { ResolvedProviderRef } from "@/utils/providers/provider-registry"
import { ANALYTICS_PROVIDER } from "@/types/analytics"
import { ALL_PROVIDER_TYPES, isLLMProvider, isLLMProviderConfig } from "@/types/config/provider"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"

const VALID_BACKEND_KINDS = new Set<AnalyticsBackendKind>(["llm", "non_llm", "unknown"])
const VALID_CANONICAL_PROVIDERS = new Set<string>(ALL_PROVIDER_TYPES)

export const UNKNOWN_FEATURE_PROVIDER: FeatureProviderAnalytics = {
  provider: ANALYTICS_PROVIDER.UNKNOWN,
  backend_kind: "unknown",
}

export const BUILT_IN_AI_FEATURE_PROVIDER: FeatureProviderAnalytics = {
  provider: ANALYTICS_PROVIDER.BUILT_IN_AI,
  backend_kind: "llm",
}

export const EDGE_TTS_FEATURE_PROVIDER: FeatureProviderAnalytics = {
  provider: ANALYTICS_PROVIDER.EDGE_TTS,
  backend_kind: "non_llm",
}

export function classifyProviderConfig(
  providerConfig: ProviderConfig | null | undefined,
): FeatureProviderAnalytics {
  if (!providerConfig) return UNKNOWN_FEATURE_PROVIDER

  return {
    provider: providerConfig.provider,
    backend_kind: isLLMProviderConfig(providerConfig) ? "llm" : "non_llm",
  }
}

export function classifyResolvedProvider(
  provider: ResolvedProviderRef | null | undefined,
): FeatureProviderAnalytics {
  if (!provider) return UNKNOWN_FEATURE_PROVIDER
  if (provider.kind === "local") return classifyProviderConfig(provider.config)
  if (provider.id === BUILT_IN_AI_PROVIDER_ID) return BUILT_IN_AI_FEATURE_PROVIDER
  return UNKNOWN_FEATURE_PROVIDER
}

export function normalizeFeatureProviderAnalytics(
  provider: unknown,
  backendKind: unknown,
): FeatureProviderAnalytics {
  if (
    typeof provider !== "string" ||
    !VALID_BACKEND_KINDS.has(backendKind as AnalyticsBackendKind)
  ) {
    return UNKNOWN_FEATURE_PROVIDER
  }

  if (provider === ANALYTICS_PROVIDER.UNKNOWN && backendKind === "unknown") {
    return UNKNOWN_FEATURE_PROVIDER
  }
  if (provider === ANALYTICS_PROVIDER.BUILT_IN_AI && backendKind === "llm") {
    return BUILT_IN_AI_FEATURE_PROVIDER
  }
  if (provider === ANALYTICS_PROVIDER.EDGE_TTS && backendKind === "non_llm") {
    return EDGE_TTS_FEATURE_PROVIDER
  }
  if (
    VALID_CANONICAL_PROVIDERS.has(provider) &&
    backendKind === (isLLMProvider(provider) ? "llm" : "non_llm")
  ) {
    return {
      provider: provider as AnalyticsProvider,
      backend_kind: backendKind as AnalyticsBackendKind,
    }
  }

  return UNKNOWN_FEATURE_PROVIDER
}
