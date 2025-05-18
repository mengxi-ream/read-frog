import type { APIProviderNames } from '@/types/config/provider'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import ProviderIcon from '@/components/provider-icon'
import { Input } from '@/components/ui/input'
import { configFields } from '@/utils/atoms/config'
import { API_PROVIDER_ITEMS, DEFAULT_PROVIDER_CONFIG } from '@/utils/constants/config'

function getPlaceholder(provider: APIProviderNames): string {
  return DEFAULT_PROVIDER_CONFIG[provider]?.baseURL || ''
}

export default function BaseURLConfig() {
  const [providersConfig, setProvidersConfig] = useAtom(configFields.providersConfig)

  const handleBaseUrlChange = useCallback((provider: APIProviderNames, newBaseUrl: string) => {
    setProvidersConfig({
      [provider]: {
        ...providersConfig[provider],
        baseURL: newBaseUrl,
      },
    })
  }, [setProvidersConfig, providersConfig])

  return (
    <div>
      <h3 className="text-md font-semibold mb-2">Base URL Config</h3>
      <div className="flex flex-col gap-2">
        {Object.entries(API_PROVIDER_ITEMS).map(([provider, item]) => {
          const providerKey = provider as APIProviderNames
          const currentConfig = providersConfig?.[providerKey]
          const currentValue = currentConfig?.baseURL ?? DEFAULT_PROVIDER_CONFIG[providerKey]?.baseURL ?? ''

          return (
            <div key={provider} className="flex items-center gap-2">
              <ProviderIcon
                className="text-sm w-50"
                logo={item.logo}
                name={item.name}
              />
              <div className="flex items-center gap-1 w-full">
                <Input
                  className="mb-2"
                  value={currentValue}
                  type="text"
                  placeholder={getPlaceholder(providerKey)}
                  onChange={e => handleBaseUrlChange(providerKey, e.target.value)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
