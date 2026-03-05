import type { Config } from "@/types/config/config"
import type { APIProviderConfig, APIProviderTypes } from "@/types/config/provider"
import { API_PROVIDER_ITEMS, DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { getUniqueName } from "@/utils/name"

export async function addProvider(
  providerType: APIProviderTypes,
  providersConfig: Config["providersConfig"],
  setProvidersConfig: (config: Partial<Config["providersConfig"]>) => Promise<void>,
  setSelectedProviderId?: (id: string) => void,
): Promise<string> {
  const existingNames = new Set(providersConfig.map(p => p.name))
  const providerName = getUniqueName(API_PROVIDER_ITEMS[providerType].name, existingNames)

  const newProvider: APIProviderConfig = {
    ...structuredClone(DEFAULT_PROVIDER_CONFIG[providerType]),
    id: crypto.randomUUID(),
    name: providerName,
  }

  const updatedProviders = [...providersConfig, newProvider]
  await setProvidersConfig(updatedProviders)

  if (setSelectedProviderId) {
    setSelectedProviderId(newProvider.id)
  }

  return newProvider.id
}
