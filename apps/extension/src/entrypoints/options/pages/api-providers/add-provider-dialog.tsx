import type { APIProviderConfig, APIProviderNames } from '@/types/config/provider'
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { useAtom } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { API_PROVIDER_NAMES } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { API_PROVIDER_ITEMS, DEFAULT_PROVIDER_CONFIG } from '@/utils/constants/providers'
import { isDarkMode } from '@/utils/tailwind'

export default function AddProviderDialog({ onClose }: { onClose: () => void }) {
  const [providersConfig, setProvidersConfig] = useAtom(configFields.providersConfig)

  const handleAddProvider = async (providerType: APIProviderNames) => {
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
      ...DEFAULT_PROVIDER_CONFIG[providerType],
      id: crypto.randomUUID(),
      name: providerName,
    }

    const updatedProviders = [...providersConfig, newProvider]
    await setProvidersConfig(updatedProviders)
    onClose()
  }

  return (
    <DialogContent className="md:max-w-xl lg:max-w-3xl xl:max-w-5xl">
      <DialogHeader>
        <DialogTitle>Add New Provider</DialogTitle>
        <DialogDescription>
          Choose an API provider to add to your configuration.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-3 py-4">
        {API_PROVIDER_NAMES.map(providerType => (
          <button
            type="button"
            key={providerType}
            className="h-auto p-3 flex flex-col items-center space-y-2 hover:bg-muted/50 rounded-lg"
            onClick={() => handleAddProvider(providerType)}
          >
            <ProviderIcon logo={API_PROVIDER_ITEMS[providerType].logo(isDarkMode())} size="xl" />
            <span
              className="text-xs font-light w-full line-clamp-2 flex-1 flex items-center justify-center"
            >
              {API_PROVIDER_ITEMS[providerType].name}
            </span>
          </button>
        ))}
      </div>
    </DialogContent>
  )
}
