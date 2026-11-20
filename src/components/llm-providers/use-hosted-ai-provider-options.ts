import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import {
  getHostedFeatureForCapability,
  isDurablyUnusableTier,
} from "@/utils/providers/provider-availability"
import { isSystemProviderSelectorItem } from "@/utils/providers/provider-display"
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
    // A model no list names has no tier to read: it is marked unavailable
    // where it was listed, and the server answers for it at run time.
    if (!isSystemProviderSelectorItem(provider) || provider.tier === undefined) {
      return provider
    }

    // Gray out only on durable account facts — sign-in and plan — which is what
    // `isDurablyUnusableTier` reads off `unavailableReason`. Transient service
    // state (exhausted quota, open circuit, a model out of budget, a billing
    // lookup that threw) keeps the option selectable and surfaces at run time.
    //
    // The previous `!accessAllowed || !hasFunding` test inverted that for the
    // transient half: a billing failure drops the plan's pools just as genuine
    // unfundedness does, so one bad lookup hard-disabled every built-in row.
    const tierStatus = getHostedAiTierStatus(status, feature, provider.tier)
    return {
      ...provider,
      disabled: isDurablyUnusableTier(tierStatus),
      upgradeTo: tierStatus?.upgradeTo ?? undefined,
    }
  })
}
