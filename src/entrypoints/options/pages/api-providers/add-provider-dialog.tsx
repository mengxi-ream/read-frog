import type { APIProviderTypes } from "@/types/config/provider"
import { i18n } from "#imports"
import { useAtom, useSetAtom } from "jotai"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/base-ui/dialog"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { API_PROVIDER_ITEMS, PROVIDER_GROUPS } from "@/utils/constants/providers"
import { selectedProviderIdAtom } from "./atoms"
import { addProvider } from "./utils"

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
        <DialogTitle>{i18n.t("options.apiProviders.dialog.title")}</DialogTitle>
      </DialogHeader>
      {Object.entries(PROVIDER_GROUPS).map(([groupKey, group]) => (
        <ProviderButtonGroup
          key={groupKey}
          groupTitle={i18n.t(`options.apiProviders.dialog.groups.${groupKey as keyof typeof PROVIDER_GROUPS}.title`)}
          groupDescription={i18n.t(`options.apiProviders.dialog.groups.${groupKey as keyof typeof PROVIDER_GROUPS}.description`)}
          providerTypes={group.types}
          handleAddProvider={handleAddProvider}
        />
      ))}
    </DialogContent>
  )
}

function ProviderButtonGroup({ groupTitle, groupDescription, providerTypes, handleAddProvider }: { groupTitle: string, groupDescription: string, providerTypes: readonly APIProviderTypes[], handleAddProvider: (providerType: APIProviderTypes) => void }) {
  return (
    <div className="my-2.5">
      <h3 className="text-base font-base text-input-foreground text-center sm:text-left">{groupTitle}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-2 text-center sm:text-left">{groupDescription}</p>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 gap-1.5 py-2">
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
      className="h-auto p-2 flex flex-col items-center space-y-1.5 hover:bg-muted/70 rounded-lg"
      onClick={() => handleAddProvider(providerType)}
    >
      <ProviderIcon logo={API_PROVIDER_ITEMS[providerType].logo(theme)} size="md" />
      <span className="text-xs font-light w-full line-clamp-2 flex-1 flex items-center justify-center">
        {API_PROVIDER_ITEMS[providerType].name}
      </span>
    </button>
  )
}
