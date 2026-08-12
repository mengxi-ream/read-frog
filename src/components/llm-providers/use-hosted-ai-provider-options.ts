import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import {
  getHostedFeatureForCapability,
  isDurablyUnusableTier,
} from "@/utils/providers/provider-availability"
import { isProviderSelectorItem } from "@/utils/providers/provider-display"
import { getHostedAiModelTier, isBuiltInAiProviderId } from "@/utils/providers/provider-registry"
import { useHostedAiStatus } from "./use-hosted-ai-status"

export function useHostedAiProviderOptions(
  capability: ProviderCapability,
  providers: ProviderSelectorOption[],
): ProviderSelectorOption[] {
  const feature = getHostedFeatureForCapability(capability)
  const { status } = useHostedAiStatus({ enabled: feature !== null })

  if (!feature) {
    return providers
  }

  return providers.map((provider) => {
    if (!isProviderSelectorItem(provider) || !isBuiltInAiProviderId(provider.id)) {
      return provider
    }

    // Gray out only on durable account facts — sign-in and plan — which is what
    // `isDurablyUnusableTier` reads off `unavailableReason`. Transient service
    // state (exhausted quota, open circuit, unconfigured model, a billing
    // lookup that threw) keeps the option selectable and surfaces at run time.
    //
    // The previous `!accessAllowed || !hasFunding` test inverted that for the
    // transient half: `credits` is emptied by a billing failure as well as by
    // genuine unfundedness, so one bad lookup hard-disabled every built-in row.
    const tierStatus = getHostedAiTierStatus(status, feature, getHostedAiModelTier(provider.id))
    return {
      ...provider,
      disabled: isDurablyUnusableTier(tierStatus),
      requiresUltra: tierStatus?.requiresUltra === true,
    }
  })
}
