import type { Config } from "@/types/config/config"
import type { APIProviderConfig, LLMProviderConfig, NonAPIProviderConfig, ProviderConfig, ProvidersConfig, PureAPIProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { isAPIProviderConfig, isLLMProviderConfig, isNonAPIProviderConfig, isPureAPIProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"

export function getProviderConfigById<T extends ProviderConfig>(providersConfig: T[], providerId: string): T | undefined {
  return providersConfig.find(p => p.id === providerId)
}

export function getLLMProvidersConfig(providersConfig: ProvidersConfig): LLMProviderConfig[] {
  return providersConfig.filter(isLLMProviderConfig)
}

export function getAPIProvidersConfig(providersConfig: ProvidersConfig): APIProviderConfig[] {
  return providersConfig.filter(isAPIProviderConfig)
}

export function getPureAPIProvidersConfig(providersConfig: ProvidersConfig): PureAPIProviderConfig[] {
  return providersConfig.filter(isPureAPIProviderConfig)
}

export function getNonAPIProvidersConfig(providersConfig: ProvidersConfig): NonAPIProviderConfig[] {
  return providersConfig.filter(isNonAPIProviderConfig)
}

export function getTranslateProvidersConfig(providersConfig: ProvidersConfig): TranslateProviderConfig[] {
  return providersConfig.filter(isTranslateProviderConfig)
}

export function filterEnabledProvidersConfig(providersConfig: ProvidersConfig): ProvidersConfig {
  return providersConfig.filter(p => p.enabled)
}

export function getProviderKeyByName(providersConfig: ProvidersConfig, providerId: string): string | undefined {
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

export function getProviderApiKey(providersConfig: ProvidersConfig, providerId: string): string | undefined {
  const providerConfig = getProviderConfigById(providersConfig, providerId)
  if (providerConfig && isAPIProviderConfig(providerConfig)) {
    return providerConfig.apiKey
  }
  return undefined
}

export function getProviderBaseURL(providersConfig: ProvidersConfig, providerId: string): string | undefined {
  const providerConfig = getProviderConfigById(providersConfig, providerId)
  if (providerConfig && isAPIProviderConfig(providerConfig)) {
    return providerConfig.baseURL
  }
  return undefined
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
    if (currentId !== deletedProviderId)
      continue
    const candidates = remainingProviders.filter(p => def.isProvider(p.provider))
    if (candidates.length > 0)
      updates[key] = candidates[0].id
  }
  return updates
}

export function findFeatureMissingProvider(
  remainingProviders: ProvidersConfig,
): FeatureKey | null {
  for (const key of FEATURE_KEYS) {
    const def = FEATURE_PROVIDER_DEFS[key]
    if (!remainingProviders.some(p => def.isProvider(p.provider)))
      return key
  }
  return null
}
