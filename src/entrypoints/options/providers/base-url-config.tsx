import type { APIProviderNames } from '@/types/config/provider'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import ProviderIcon from '@/components/provider-icon'
import { Input } from '@/components/ui/input'
import { configFields } from '@/utils/atoms/config'
import { API_PROVIDER_ITEMS } from '@/utils/constants/config'

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

  // get placeholder for each provider
  const getPlaceholder = (provider: string) => {
    switch (provider) {
      case 'openrouter':
        return 'https://openrouter.ai/api/v1'
      case 'openai':
        return 'https://api.openai.com/v1'
      case 'anthropic':
        return 'https://api.anthropic.com'
      case 'deepseek':
        return 'https://api.deepseek.com/v1'
      default:
        return `https://api.${provider}.com/v1`
    }
  }

  return (
    <div>
      <h3 className="text-md font-semibold mb-2">Base URL Config</h3>
      <div className="flex flex-col gap-2">
        {Object.entries(providersConfig || {}).map(([provider, config]) => (
          <div key={provider} className="flex items-center gap-2">
            <ProviderIcon
              className="text-sm w-50"
              logo={API_PROVIDER_ITEMS[provider as APIProviderNames]?.logo}
              name={API_PROVIDER_ITEMS[provider as APIProviderNames]?.name}
            />
            <div className="flex items-center gap-1 w-full">
              <Input
                className="mb-2"
                value={config?.baseURL ?? getPlaceholder(provider)}
                type="text"
                placeholder={getPlaceholder(provider)}
                onChange={e => handleBaseUrlChange(provider as APIProviderNames, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
