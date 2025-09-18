import type { Config } from '@/types/config/config'
import type { APIProviderConfig, LLMTranslateProviderConfig, NonAPIProviderConfig, ProviderConfig, ProvidersConfig, PureAPIProviderConfig, ReadProviderConfig, TranslateProviderConfig } from '@/types/config/provider'
import { isAPIProviderConfig, isLLMTranslateProviderConfig, isNonAPIProviderConfig, isPureAPIProviderConfig, isReadProviderConfig, isTranslateProviderConfig } from '@/types/config/provider'

export function getProviderConfigById<T extends ProviderConfig>(providersConfig: T[], providerId: string): T | undefined {
  return providersConfig.find(p => p.id === providerId)
}

export function getLLMTranslateProvidersConfig(providersConfig: ProvidersConfig): LLMTranslateProviderConfig[] {
  return providersConfig.filter(isLLMTranslateProviderConfig)
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

export function getReadProvidersConfig(providersConfig: ProvidersConfig): ReadProviderConfig[] {
  return providersConfig.filter(isReadProviderConfig)
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

export function getReadModelConfig(config: Config, providerId: string) {
  const provider = getProviderConfigById(config.providersConfig, providerId)
  if (provider && isReadProviderConfig(provider)) {
    return provider.models.read
  }
  return undefined
}

export function getTranslateModelConfig(config: Config, providerId: string) {
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)
  if (providerConfig && isLLMTranslateProviderConfig(providerConfig)) {
    return providerConfig.models.translate
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
