import { i18n } from '#imports'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getLLMTranslateProvidersConfig, getNonAPIProvidersConfig, getPureAPIProvidersConfig } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { useTheme } from '../providers/theme-provider'

export default function TranslateProviderSelector({ className }: { className?: string }) {
  const { theme } = useTheme()
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const filteredProvidersConfig = filterEnabledProvidersConfig(providersConfig)

  const isTranslationOnlyMode = translateConfig.mode === 'translationOnly'
  const nonAPIProviders = getNonAPIProvidersConfig(filteredProvidersConfig)
  const filteredNonAPIProviders = isTranslationOnlyMode
    ? nonAPIProviders.filter(p => p.provider !== 'google')
    : nonAPIProviders

  return (
    <Select
      value={translateConfig.providerId}
      onValueChange={(value: string) => {
        void setTranslateConfig({
          providerId: value,
        })
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{i18n.t('translateService.aiTranslator')}</SelectLabel>
          {getLLMTranslateProvidersConfig(filteredProvidersConfig).map(({ id, name, provider }) => (
            <SelectItem key={id} value={id}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>{i18n.t('translateService.normalTranslator')}</SelectLabel>
          {filteredNonAPIProviders.map(({ id, name, provider }) => (
            <SelectItem key={id} value={id}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
            </SelectItem>
          ))}
          {getPureAPIProvidersConfig(filteredProvidersConfig).map(({ id, name, provider }) => (
            <SelectItem key={id} value={id}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
