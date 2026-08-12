import type { ProviderCapability } from "./provider-registry"
import type { ProvidersConfig } from "@/types/config/provider"
import type { HostedAiFeature, HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import {
  getHostedAiModelTier,
  getProviderIdsForCapability,
  isBuiltInAiProviderId,
} from "./provider-registry"

/**
 * Capability -> hosted feature. They share names today, but a capability is a
 * client-side provider-picker concept and a feature is the server's billing
 * subject; keeping the mapping explicit is what lets one diverge from the
 * other. `null` means the capability has no hosted route, so no status gate.
 */
const CAPABILITY_HOSTED_FEATURES = {
  pageTranslation: "pageTranslation",
  selectionTranslation: "selectionTranslation",
  videoSubtitles: "videoSubtitles",
  inputTranslation: "inputTranslation",
  noteSuggestion: "noteSuggestion",
  customAction: "customAction",
  languageDetection: "languageDetection",
} as const satisfies Record<ProviderCapability, HostedAiFeature>

export function getHostedFeatureForCapability(
  capability: ProviderCapability,
): HostedAiFeature | null {
  return CAPABILITY_HOSTED_FEATURES[capability] ?? null
}

/**
 * Whether a tier is unusable for a reason the user can act on and that will not
 * change on its own: sign in, or buy Ultra.
 *
 * Read off `unavailableReason` rather than recomputed from `accessAllowed` and
 * the `credits` array. The server already separates the two — it reports an
 * unfunded Ultra-gated tier as `ultra_required` ("an upgrade wall, not an
 * outage") and routes every transient condition to `service_unavailable`,
 * including a billing lookup that threw. Deriving durability from an empty
 * `credits` array instead conflates them in both directions: a momentary
 * billing failure empties `credits` for an account that is perfectly entitled.
 *
 * Everything else the server can report — `quota_exhausted`,
 * `service_unavailable` (open circuit, unconfigured model, unreadable quota
 * pool) — is transient and must not make a provider look permanently broken.
 *
 * Unknown status (still loading, or the status fetch failed) reads as usable.
 * Not knowing is not the same as knowing it is walled off, and failing closed
 * here would block destructive actions whenever the network hiccups.
 */
export function isDurablyUnusableTier(tier: HostedAiTierStatus | undefined): boolean {
  return (
    tier?.unavailableReason === "authentication_required" ||
    tier?.unavailableReason === "ultra_required"
  )
}

/**
 * Only built-in providers can be durably unusable: a local provider carries its
 * own credentials, so its usability is a config question this module does not
 * answer (see the API-key warning on the provider form).
 */
export function isProviderIdDurablyUnusable(
  providerId: string,
  capability: ProviderCapability,
  status: HostedAiStatus | undefined,
): boolean {
  if (!isBuiltInAiProviderId(providerId)) {
    return false
  }
  const feature = getHostedFeatureForCapability(capability)
  if (!feature) {
    return false
  }
  return isDurablyUnusableTier(
    getHostedAiTierStatus(status, feature, getHostedAiModelTier(providerId)),
  )
}

/**
 * The provider ids that can actually run this capability for this account.
 *
 * `getProviderIdsForCapability` appends the built-ins unconditionally — its
 * `requireEnable` filters only local rows — so a bare length check on it is
 * always satisfied and cannot tell "a provider exists" from "a provider that
 * works exists". Every caller that gates an action on having a provider wants
 * this one instead.
 */
export function getUsableProviderIdsForCapability(
  capability: ProviderCapability,
  providersConfig: ProvidersConfig,
  status: HostedAiStatus | undefined,
): string[] {
  return getProviderIdsForCapability(capability, providersConfig, { requireEnable: true }).filter(
    (providerId) => !isProviderIdDurablyUnusable(providerId, capability, status),
  )
}
