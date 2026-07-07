import type { Config } from "@/types/config/config"
import type { APIProviderConfig, APIProviderTypes } from "@/types/config/provider"
import { API_PROVIDER_ITEMS, DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import { getUniqueName } from "@/utils/name"

/**
 * Resolve a provider's default description in the current interface language at creation
 * time (it is no longer baked into DEFAULT_PROVIDER_CONFIG at module-import, which would
 * freeze the string). Returns undefined for provider types without a description key
 * (the facade returns "" for a missing key).
 */
function getDefaultProviderDescription(providerType: APIProviderTypes): string | undefined {
  const description = i18n.t(
    `options.apiProviders.providers.description.${providerType}` as never,
  )
  return description || undefined
}

export async function addProvider(
  providerType: APIProviderTypes,
  providersConfig: Config["providersConfig"],
  setProvidersConfig: (config: Partial<Config["providersConfig"]>) => Promise<void>,
  setSelectedProviderId?: (id: string) => void,
): Promise<string> {
  const existingNames = new Set(providersConfig.map(p => p.name))
  const providerName = getUniqueName(API_PROVIDER_ITEMS[providerType].name, existingNames)

  const description = getDefaultProviderDescription(providerType)
  const newProvider: APIProviderConfig = {
    ...structuredClone(DEFAULT_PROVIDER_CONFIG[providerType]),
    ...(description ? { description } : {}),
    id: getRandomUUID(),
    name: providerName,
  }

  const updatedProviders = [...providersConfig, newProvider]
  await setProvidersConfig(updatedProviders)

  if (setSelectedProviderId) {
    setSelectedProviderId(newProvider.id)
  }

  return newProvider.id
}

export async function duplicateProvider(
  providerConfig: APIProviderConfig,
  providersConfig: Config["providersConfig"],
  setProvidersConfig: (config: Partial<Config["providersConfig"]>) => Promise<void>,
  setSelectedProviderId?: (id: string) => void,
): Promise<string> {
  const existingNames = new Set(providersConfig.map(p => p.name))
  const newProvider: APIProviderConfig = {
    ...structuredClone(providerConfig),
    id: getRandomUUID(),
    name: getUniqueName(providerConfig.name, existingNames),
  }

  const updatedProviders = [...providersConfig, newProvider]
  await setProvidersConfig(updatedProviders)

  if (setSelectedProviderId) {
    setSelectedProviderId(newProvider.id)
  }

  return newProvider.id
}
