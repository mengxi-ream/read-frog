import type { AnalyticsFailureReason } from "@/types/analytics"
import type { ErrorAction } from "@/utils/error-action"
import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import type { CustomActionProviderRef } from "@/utils/providers/provider-registry"
import { logInAction, upgradeAction } from "@/utils/error-action"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import { isProviderIdDurablyUnusable } from "@/utils/providers/provider-availability"
import {
  BUILT_IN_AI_PROVIDER_ID,
  getHostedAiModelTier,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"

/** The provider the action is saved with, which has no API key. */
export interface MissingApiKeyProvider {
  providerId: string
  providerName: string
}

/**
 * What the card says about a provider that has no API key:
 * - `fallback`: the Built-in AI answered instead.
 * - `blocked`: the Built-in AI cannot answer for this account either, so the
 *   card offers to add the key, or to sign in or upgrade for the Built-in AI.
 */
export type MissingApiKeyState =
  | (MissingApiKeyProvider & { kind: "fallback" })
  | (MissingApiKeyProvider & { kind: "blocked"; builtInAiAction: ErrorAction })

/**
 * The provider a keyless action falls back to. Never saved: once the user adds
 * the key, the action runs on their own provider again.
 */
export function getMissingApiKeyFallbackProvider(): CustomActionProviderRef {
  const provider = resolveProviderRefForCapability("customAction", [], BUILT_IN_AI_PROVIDER_ID)
  if (!provider) {
    throw new Error("The Built-in AI must serve custom actions")
  }
  return provider
}

/**
 * Why the Built-in AI cannot answer for this account, as the call to action
 * that lifts the wall, or null when it can (or might: an unknown status reads
 * as usable, and the background's gate has the final word at run time).
 */
export function getBuiltInAiWallAction(status: HostedAiStatus | undefined): ErrorAction | null {
  if (!isProviderIdDurablyUnusable(BUILT_IN_AI_PROVIDER_ID, "customAction", status)) {
    return null
  }
  const tier = getHostedAiTierStatus(
    status,
    "customAction",
    getHostedAiModelTier(BUILT_IN_AI_PROVIDER_ID),
  )
  return tier?.unavailableReason === "authentication_required" ? logInAction() : upgradeAction()
}

/**
 * The same wall, read off a failed Built-in AI run, for when the status was not
 * known up front. Other failures (quota, outage) are not about the missing key.
 */
export function getBuiltInAiWallActionForFailure(
  reason: AnalyticsFailureReason,
): ErrorAction | null {
  switch (reason) {
    case "auth_required":
      return logInAction()
    case "tier_restricted":
      return upgradeAction()
    default:
      return null
  }
}
