import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { configFields } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getReadProvidersConfig } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { isDarkMode } from '@/utils/tailwind'

export default function ReadProviderSelector({ className, hideChevron = false, customTrigger }: { className?: string, hideChevron?: boolean, customTrigger?: React.ReactNode }) {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const filteredProvidersConfig = filterEnabledProvidersConfig(providersConfig)

  return (
    <Select
      value={readConfig.providerId}
      onValueChange={(value: string) => {
        void setReadConfig({
          providerId: value,
        })
      }}
    >
      <SelectTrigger className={className} hideChevron={hideChevron}>
        {customTrigger || <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {getReadProvidersConfig(filteredProvidersConfig).map(({ id, name, provider }) => (
          <SelectItem key={id} value={id}>
            <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(isDarkMode())} name={name} size="sm" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
