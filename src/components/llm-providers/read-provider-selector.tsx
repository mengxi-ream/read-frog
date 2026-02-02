import type { ReadProviderConfig } from '@/types/config/provider'
import { useAtom, useAtomValue } from 'jotai'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/base-ui/select'
import ProviderIcon from '@/components/provider-icon'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getReadProvidersConfig } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { useTheme } from '../providers/theme-provider'

export default function ReadProviderSelector({ className, customTrigger }: { className?: string, customTrigger?: React.ReactNode }) {
  const { theme } = useTheme()
  const [readConfig, setReadConfig] = useAtom(configFieldsAtomMap.read)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const filteredProvidersConfig = filterEnabledProvidersConfig(providersConfig)

  const readProviders = getReadProvidersConfig(filteredProvidersConfig)
  const currentProvider = readProviders.find(p => p.id === readConfig.providerId)

  return (
    <Select<ReadProviderConfig>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider)
          return
        void setReadConfig({
          providerId: provider.id,
        })
      }}
      itemToStringValue={p => p.id}
    >
      <SelectTrigger className={className} id="read-provider">
        {customTrigger || (
          <SelectValue>
            {(provider: ReadProviderConfig) => (
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            )}
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {readProviders.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
