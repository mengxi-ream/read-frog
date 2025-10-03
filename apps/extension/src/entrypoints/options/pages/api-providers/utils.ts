import type { Config } from '@/types/config/config'
import type { APIProviderConfig, APIProviderTypes } from '@/types/config/provider'
import { API_PROVIDER_ITEMS, DEFAULT_PROVIDER_CONFIG } from '@/utils/constants/providers'

export async function addProvider(
  providerType: APIProviderTypes,
  providersConfig: Config['providersConfig'],
  setProvidersConfig: (config: Partial<Config['providersConfig']>) => Promise<void>,
  setSelectedProviderId?: (id: string) => void,
): Promise<string> {
  const existingProviderNameSet = new Set(providersConfig.map(p => p.name))
  let providerName = API_PROVIDER_ITEMS[providerType].name

  for (let i = 0; i <= providersConfig.length; i++) {
    const currentProviderName = i === 0 ? API_PROVIDER_ITEMS[providerType].name : `${API_PROVIDER_ITEMS[providerType].name} ${i}`
    if (!existingProviderNameSet.has(currentProviderName)) {
      providerName = currentProviderName
      break
    }
  }

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
