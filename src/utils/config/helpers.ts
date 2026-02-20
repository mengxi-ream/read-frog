import type { Config } from '@/types/config/config'
import type { APIProviderConfig, LLMProviderConfig, NonAPIProviderConfig, ProviderConfig, ProvidersConfig, PureAPIProviderConfig, TranslateProviderConfig, TTSProviderConfig } from '@/types/config/provider'
import type { FeatureKey } from '@/utils/constants/feature-providers'
import { isAPIProviderConfig, isLLMProviderConfig, isNonAPIProviderConfig, isPureAPIProviderConfig, isTranslateProviderConfig, isTTSProviderConfig } from '@/types/config/provider'
import { mergeWithArrayOverwrite } from '@/utils/atoms/config'
import { FEATURE_PROVIDER_DEFS } from '@/utils/constants/feature-providers'

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

export function getTTSProvidersConfig(providersConfig: ProvidersConfig): TTSProviderConfig[] {
  return providersConfig.filter(isTTSProviderConfig)
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
 * For each feature using the deleted provider, picks the first compatible remaining provider,
 * or null if the feature is nullable.
 */
export function computeProviderFallbacksAfterDeletion(
  deletedProviderId: string,
  config: Config,
  remainingProviders: ProvidersConfig,
): Partial<Record<FeatureKey, string | null>> {
  const updates: Partial<Record<FeatureKey, string | null>> = {}
  for (const [key, def] of Object.entries(FEATURE_PROVIDER_DEFS)) {
    const currentId = def.getProviderId(config)
    if (currentId !== deletedProviderId)
      continue
    const candidates = remainingProviders.filter(p => def.isProvider(p.provider))
    if (candidates.length > 0)
      updates[key as FeatureKey] = candidates[0].id
    else if (def.nullable)
      updates[key as FeatureKey] = null
  }
  return updates
}

/**
 * Convert a feature→providerId mapping into a Partial<Config> using FEATURE_PROVIDER_DEFS.configPath.
 * Generic — works for any scenario that assigns provider IDs to features.
 */
export function buildFeatureProviderPatch(
  assignments: Partial<Record<FeatureKey, string | null>>,
): Partial<Config> {
  let patch: Record<string, any> = {}

  for (const [key, newId] of Object.entries(assignments)) {
    const def = FEATURE_PROVIDER_DEFS[key as FeatureKey]

    const fragment: Record<string, any> = {}
    let current = fragment
    for (let i = 0; i < def.configPath.length - 1; i++) {
      current[def.configPath[i]] = {}
      current = current[def.configPath[i]]
    }
    current[def.configPath[def.configPath.length - 1]] = newId

    patch = mergeWithArrayOverwrite(patch, fragment) as Record<string, any>
  }

  return patch as Partial<Config>
}

export function findFeatureMissingProvider(
  remainingProviders: ProvidersConfig,
): FeatureKey | null {
  for (const [key, def] of Object.entries(FEATURE_PROVIDER_DEFS)) {
    if (def.nullable)
      continue
    if (remainingProviders.filter(p => def.isProvider(p.provider)).length === 0)
      return key as FeatureKey
  }
  return null
}
