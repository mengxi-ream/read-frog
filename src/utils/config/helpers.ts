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
import {
  isAPIProviderConfig,
  isLLMProviderConfig,
  isNonAPIProviderConfig,
  isPureAPIProviderConfig,
  isTranslateProviderConfig,
} from "@/types/config/provider"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { getProviderIdsForCapability } from "@/utils/providers/provider-registry"

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
): Partial<Config["languageDetection"]> | null {
  if (nextMode === "basic") {
    return { mode: "basic" }
  }

  const enabledLLMProviders = getEnabledLLMProvidersConfig(providersConfig)
  if (enabledLLMProviders.length === 0) {
    return null
  }

  const hasSelectedProvider = enabledLLMProviders.some(
    (provider) => provider.id === currentConfig.providerId,
  )
  return {
    mode: "llm",
    providerId: hasSelectedProvider ? currentConfig.providerId : enabledLLMProviders[0]!.id,
  }
}

/**
 * Compute fallback provider assignments when a provider is deleted.
 * For each feature using the deleted provider, picks the first compatible remaining provider.
 */
export function computeProviderFallbacksAfterDeletion(
  deletedProviderId: string,
  config: Config,
  remainingProviders: ProvidersConfig,
): Partial<Record<FeatureKey, string>> {
  const updates: Partial<Record<FeatureKey, string>> = {}
  for (const key of FEATURE_KEYS) {
    const def = FEATURE_PROVIDER_DEFS[key]
    const currentId = def.getProviderId(config)
    if (currentId !== deletedProviderId) continue
    const fallbackProviderId = getProviderIdsForCapability(key, remainingProviders, {
      requireEnable: true,
    })[0]
    if (fallbackProviderId) updates[key] = fallbackProviderId
  }
  return updates
}

export function findFeatureMissingProvider(
  remainingProviders: ProvidersConfig,
  config?: Config,
): FeatureKey | "languageDetection" | null {
  for (const key of FEATURE_KEYS) {
    if (!getProviderIdsForCapability(key, remainingProviders, { requireEnable: true })[0])
      return key
  }

  if (
    config?.languageDetection.mode === "llm" &&
    getEnabledLLMProvidersConfig(remainingProviders).length === 0
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
): Config["selectionToolbar"] | null {
  const affectedActions = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.providerId === deletedProviderId,
  )

  if (affectedActions.length === 0) {
    return null
  }

  const fallbackProviderId = getProviderIdsForCapability("customAction", remainingProviders, {
    requireEnable: true,
  })[0]
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
): string | undefined | null {
  if (config.languageDetection.mode !== "llm") return null
  if (config.languageDetection.providerId !== deletedProviderId) return null

  const fallback = getEnabledLLMProvidersConfig(remainingProviders)[0]
  return fallback?.id
}
