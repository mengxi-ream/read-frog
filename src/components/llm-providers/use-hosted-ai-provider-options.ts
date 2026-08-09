import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { getHostedAiCreditForFeature, getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import { isProviderSelectorItem } from "@/utils/providers/provider-display"
import { getHostedAiModelTier, isBuiltInAiProviderId } from "@/utils/providers/provider-registry"
import { useHostedAiStatus } from "./use-hosted-ai-status"

function getFeatureForCapability(capability: ProviderCapability) {
  if (capability === "pageTranslation") return "pageTranslation" as const
  if (capability === "customAction") return "customAction" as const
  return null
}

export function useHostedAiProviderOptions(
  capability: ProviderCapability,
  providers: ProviderSelectorOption[],
): ProviderSelectorOption[] {
  const feature = getFeatureForCapability(capability)
  const { status } = useHostedAiStatus({ enabled: feature !== null })

  if (!feature) {
    return providers
  }

  // A pool in `credits` covering the feature means this plan funds it; funding
  // is plan-level, so one lookup serves both tiers.
  const hasFunding = getHostedAiCreditForFeature(status, feature) !== undefined

  return providers.map((provider) => {
    if (!isProviderSelectorItem(provider) || !isBuiltInAiProviderId(provider.id)) {
      return provider
    }

    // Gray out only on durable account facts: missing access (sign-in / plan,
    // `accessAllowed`) or a plan without a funding pool for this feature.
    // Transient service state — exhausted quota, open circuit, unconfigured
    // model — keeps the option selectable and surfaces at run time instead.
    // Fail open while status is unknown (still loading, or the status endpoint
    // itself failing), so one failed status fetch never latches every built-in
    // option disabled.
    const tierStatus = getHostedAiTierStatus(status, feature, getHostedAiModelTier(provider.id))
    return {
      ...provider,
      disabled: tierStatus ? !tierStatus.accessAllowed || !hasFunding : false,
      requiresUltra: tierStatus?.requiresUltra === true,
    }
  })
}
