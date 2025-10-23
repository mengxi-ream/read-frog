import type { APIProviderTypes } from '@/types/config/provider'
import { i18n } from '#imports'
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { useAtom, useSetAtom } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { useTheme } from '@/components/providers/theme-provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { API_PROVIDER_ITEMS, PROVIDER_GROUPS } from '@/utils/constants/providers'
import { selectedProviderIdAtom } from './atoms'
import { addProvider } from './utils'

export default function AddProviderDialog({ onClose }: { onClose: () => void }) {
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const setSelectedProviderId = useSetAtom(selectedProviderIdAtom)

  const handleAddProvider = async (providerType: APIProviderTypes) => {
    await addProvider(providerType, providersConfig, setProvidersConfig, setSelectedProviderId)
    onClose()
  }

  return (
    <DialogContent className="md:max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{i18n.t('options.apiProviders.dialog.title')}</DialogTitle>
        <DialogDescription>
          {i18n.t('options.apiProviders.dialog.description')}
        </DialogDescription>
      </DialogHeader>
      {Object.entries(PROVIDER_GROUPS).map(([groupTitle, group]) => (
        <ProviderButtonGroup key={groupTitle} groupTitle={i18n.t(`options.apiProviders.dialog.groups.${groupTitle as keyof typeof PROVIDER_GROUPS}`)} providerTypes={group.types} handleAddProvider={handleAddProvider} />
      ))}
    </DialogContent>
  )
}

function ProviderButtonGroup({ groupTitle, providerTypes, handleAddProvider }: { groupTitle: string, providerTypes: readonly APIProviderTypes[], handleAddProvider: (providerType: APIProviderTypes) => void }) {
  return (
    <div>
      <h3 className="text-base font-base text-input-foreground text-center sm:text-left">{groupTitle}</h3>
      <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 py-3">
        {providerTypes.map(providerType => (
          <ProviderButton key={providerType} providerType={providerType} handleAddProvider={handleAddProvider} />
        ))}
      </div>
    </div>
  )
}

function ProviderButton({ providerType, handleAddProvider }: { providerType: APIProviderTypes, handleAddProvider: (providerType: APIProviderTypes) => void }) {
  const { theme } = useTheme()
  return (
    <button
      type="button"
      key={providerType}
      className="h-auto p-3 flex flex-col items-center space-y-2 hover:bg-muted/70 rounded-lg"
      onClick={() => handleAddProvider(providerType)}
    >
      <ProviderIcon logo={API_PROVIDER_ITEMS[providerType].logo(theme)} size="lg" />
      <span className="text-xs font-light w-full line-clamp-2 flex-1 flex items-center justify-center">
        {API_PROVIDER_ITEMS[providerType].name}
      </span>
    </button>
  )
}
