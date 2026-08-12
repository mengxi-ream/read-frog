import type { Config } from "@/types/config/config"
import type { LanguageDetectionMode } from "@/types/config/language-detection"
import type {
  APIProviderConfig,
  LLMProviderConfig,
  NonAPIProviderConfig,
  ProviderConfig,
  ProvidersConfig,
  PureAPIProviderConfig,
  TranslateProviderConfig,
} from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import {
  isAPIProviderConfig,
  isLLMProviderConfig,
  isNonAPIProviderConfig,
  isPureAPIProviderConfig,
  isTranslateProviderConfig,
} from "@/types/config/provider"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { getUsableProviderIdsForCapability } from "@/utils/providers/provider-availability"

export function getProviderConfigById<T extends ProviderConfig>(
  providersConfig: T[],
  providerId: string,
): T | undefined {
  return providersConfig.find((p) => p.id === providerId)
}

export function getLLMProvidersConfig(providersConfig: ProvidersConfig): LLMProviderConfig[] {
  return providersConfig.filter(isLLMProviderConfig)
}

export function getAPIProvidersConfig(providersConfig: ProvidersConfig): APIProviderConfig[] {
  return providersConfig.filter(isAPIProviderConfig)
}

export function getPureAPIProvidersConfig(
  providersConfig: ProvidersConfig,
): PureAPIProviderConfig[] {
  return providersConfig.filter(isPureAPIProviderConfig)
}

export function getNonAPIProvidersConfig(providersConfig: ProvidersConfig): NonAPIProviderConfig[] {
  return providersConfig.filter(isNonAPIProviderConfig)
}

export function getTranslateProvidersConfig(
  providersConfig: ProvidersConfig,
): TranslateProviderConfig[] {
  return providersConfig.filter(isTranslateProviderConfig)
}

export function filterEnabledProvidersConfig(providersConfig: ProvidersConfig): ProvidersConfig {
  return providersConfig.filter((p) => p.enabled)
}

export function getEnabledLLMProvidersConfig(
  providersConfig: ProvidersConfig,
): LLMProviderConfig[] {
  return filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig)
}

export function getProviderKeyByName(
  providersConfig: ProvidersConfig,
  providerId: string,
): string | undefined {
  const provider = getProviderConfigById(providersConfig, providerId)
  return provider?.provider
}

export function getProviderModelConfig(config: Config, providerId: string) {
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)
  if (providerConfig && isLLMProviderConfig(providerConfig)) {
    return providerConfig.model
  }
  return undefined
}

export function getProviderApiKey(
  providersConfig: ProvidersConfig,
  providerId: string,
): string | undefined {
  const providerConfig = getProviderConfigById(providersConfig, providerId)
  if (providerConfig && isAPIProviderConfig(providerConfig)) {
    return providerConfig.apiKey
  }
  return undefined
}

export function resolveLanguageDetectionConfigForModeChange(
  currentConfig: Config["languageDetection"],
  nextMode: LanguageDetectionMode,
  providersConfig: ProvidersConfig,
  status?: HostedAiStatus,
): Partial<Config["languageDetection"]> | null {
  if (nextMode === "basic") {
    return { mode: "basic" }
  }

  // Capability-based, not providersConfig-based: Built-in AI is synthesized by
  // the registry and never a row in providersConfig, so a plain filter there
  // would report "no LLM available" on a fresh profile that can in fact run
  // hosted detection. Filtered by usability, because the built-ins are in that
  // list for every account — arming LLM mode against a tier the plan does not
  // fund produces a green "enabled" indicator over a path that never runs.
  const availableIds = getUsableProviderIdsForCapability(
    "languageDetection",
    providersConfig,
    status,
  )
  if (availableIds.length === 0) {
    return null
  }

  const hasSelectedProvider =
    currentConfig.providerId !== undefined && availableIds.includes(currentConfig.providerId)
  return {
    mode: "llm",
    providerId: hasSelectedProvider ? currentConfig.providerId : availableIds[0]!,
  }
}

/**
 * Compute fallback provider assignments when a provider is deleted.
 * For each feature using the deleted provider, picks the first remaining
 * provider that can actually run it — reassigning to one the account cannot use
 * is what turns a delete into a silently broken feature.
 */
export function computeProviderFallbacksAfterDeletion(
  deletedProviderId: string,
  config: Config,
  remainingProviders: ProvidersConfig,
  status?: HostedAiStatus,
): Partial<Record<FeatureKey, string>> {
  const updates: Partial<Record<FeatureKey, string>> = {}
  for (const key of FEATURE_KEYS) {
    const def = FEATURE_PROVIDER_DEFS[key]
    const currentId = def.getProviderId(config)
    if (currentId !== deletedProviderId) continue
    const fallbackProviderId = getUsableProviderIdsForCapability(key, remainingProviders, status)[0]
    if (fallbackProviderId) updates[key] = fallbackProviderId
  }
  return updates
}

/**
 * The first feature that would be left with no provider that can actually run
 * it, or null when every feature keeps a working one.
 *
 * Gated on usable providers, not merely present ones. `getProviderIdsForCapability`
 * appends the built-ins unconditionally, so the old presence check was
 * satisfied for every feature and this guard never fired — a user could delete
 * their last BYOK provider and have half the extension silently reassigned to a
 * tier their plan does not fund.
 *
 * `status` decides which built-ins count. Omitting it (or passing a status that
 * has not loaded) treats them as usable, so an unreachable status endpoint
 * cannot block someone from deleting their own credentials.
 *
 * Features the user has switched off count too. Their `providerId` is stored
 * either way, and `computeProviderFallbacksAfterDeletion` can only reassign it
 * when a replacement exists — so letting the delete through leaves the slot
 * pointing at a provider that no longer exists at all, which resolves to null
 * the moment the feature is switched back on.
 */
export function findFeatureMissingProvider(
  remainingProviders: ProvidersConfig,
  config?: Config,
  status?: HostedAiStatus,
): FeatureKey | "languageDetection" | null {
  for (const key of FEATURE_KEYS) {
    if (!getUsableProviderIdsForCapability(key, remainingProviders, status)[0]) {
      return key
    }
  }

  if (
    config?.languageDetection.mode === "llm" &&
    getUsableProviderIdsForCapability("languageDetection", remainingProviders, status).length === 0
  ) {
    return "languageDetection"
  }

  return null
}

/**
 * Reassign selection toolbar actions that reference the deleted provider.
 * Fallback target must be the first enabled LLM provider.
 * Returns null when no action is affected or when no fallback exists.
 */
export function computeSelectionToolbarCustomActionFallbacksAfterDeletion(
  deletedProviderId: string,
  config: Config,
  remainingProviders: ProvidersConfig,
  status?: HostedAiStatus,
): Config["selectionToolbar"] | null {
  const affectedActions = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.providerId === deletedProviderId,
  )

  if (affectedActions.length === 0) {
    return null
  }

  const fallbackProviderId = getUsableProviderIdsForCapability(
    "customAction",
    remainingProviders,
    status,
  )[0]
  if (!fallbackProviderId) {
    return null
  }

  return affectedActions.reduce(
    (selectionToolbar, action) =>
      patchSelectionToolbarAction(selectionToolbar, action.id, {
        providerId: fallbackProviderId,
      }),
    config.selectionToolbar,
  )
}

/**
 * Compute languageDetection fallback when a provider is deleted.
 * Only applies when mode is "llm" and the deleted provider is the current one.
 * Returns the new providerId (first enabled LLM), or undefined if none available.
 * Returns null when no change is needed.
 */
export function computeLanguageDetectionFallbackAfterDeletion(
  deletedProviderId: string,
  config: Config,
  remainingProviders: ProvidersConfig,
  status?: HostedAiStatus,
): string | undefined | null {
  if (config.languageDetection.mode !== "llm") return null
  if (config.languageDetection.providerId !== deletedProviderId) return null

  // Built-in AI is always in the capability list, but only counts here when the
  // account can actually run it: handing detection to a walled-off tier is what
  // produced a green "LLM detection enabled" card over a path that never ran.
  return getUsableProviderIdsForCapability("languageDetection", remainingProviders, status)[0]
}
