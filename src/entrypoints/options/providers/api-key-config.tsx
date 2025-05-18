import type { APIProviderNames } from '@/types/config/provider'
import { useAtom } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { Input } from '@/components/ui/input'
import { configFields } from '@/utils/atoms/config'
import { API_PROVIDER_ITEMS } from '@/utils/constants/config'

export default function APIKeyConfig() {
  const [providersConfig, setProvidersConfig] = useAtom(configFields.providersConfig)
  const [showAPIKey, _setShowAPIKey] = useState(true)
  return (
    <div>
      <h3 className="text-md font-semibold mb-2">API Key Config</h3>
      <div className="flex flex-col gap-2">
        {Object.entries(providersConfig).map(([provider, config]) => (
          <div key={provider} className="flex items-center gap-2">
            <ProviderIcon className="text-sm w-50" logo={API_PROVIDER_ITEMS[provider as APIProviderNames].logo} name={API_PROVIDER_ITEMS[provider as APIProviderNames].name} />
            <div className="flex items-center gap-1 w-full">
              {/* <label htmlFor="email" className="text-sm font-medium">
                API Key
              </label> */}
              <Input
                className="mb-2"
                value={config.apiKey}
                type={showAPIKey ? 'text' : 'password'}
                onChange={e =>
                  setProvidersConfig({
                    ...providersConfig,
                    [provider]: {
                      ...config,
                      apiKey: e.target.value,
                    },
                  })}
              />
              {/* <div className="flex items-center space-x-2">
                <Checkbox
                  id={`apiKey-${provider}`}
                  checked={showAPIKey}
                  onCheckedChange={checked => setShowAPIKey(checked === true)}
                />
                <label
                  htmlFor={`apiKey-${provider}`}
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {i18n.t('options.providerConfig.apiKey.showAPIKey')}
                </label>
              </div> */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
