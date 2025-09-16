import type { APIProviderConfig, APIProviderNames } from '@/types/config/provider'
import { Button } from '@repo/ui/components/button'
import { DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
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
    <DialogContent className="md:max-w-xl lg:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add New Provider</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2 py-4">
        {API_PROVIDER_NAMES.map(providerType => (
          <Button
            key={providerType}
            variant="outline"
            className="h-auto p-3 justify-start"
            onClick={() => handleAddProvider(providerType)}
          >
            <div className="flex items-center gap-3">
              <ProviderIcon logo={API_PROVIDER_ITEMS[providerType].logo(isDarkMode())} size="xl" />
              <span className="text-sm font-medium">
                {API_PROVIDER_ITEMS[providerType].name}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </DialogContent>
  )
}
