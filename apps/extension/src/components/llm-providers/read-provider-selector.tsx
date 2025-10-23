import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getReadProvidersConfig } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { useTheme } from '../providers/theme-provider'

export default function ReadProviderSelector({ className, hideChevron = false, customTrigger, container }: { className?: string, hideChevron?: boolean, customTrigger?: React.ReactNode, container?: HTMLElement | null }) {
  const { theme } = useTheme()
  const [readConfig, setReadConfig] = useAtom(configFieldsAtomMap.read)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
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
      <SelectContent container={container}>
        {getReadProvidersConfig(filteredProvidersConfig).map(({ id, name, provider }) => (
          <SelectItem key={id} value={id}>
            <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
