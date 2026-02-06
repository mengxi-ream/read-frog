import type { TranslateProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/base-ui/select'
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
    ? nonAPIProviders.filter(p => p.provider !== 'google-translate')
    : nonAPIProviders

  const llmProviders = getLLMTranslateProvidersConfig(filteredProvidersConfig)
  const pureAPIProviders = getPureAPIProvidersConfig(filteredProvidersConfig)
  const allProviders: TranslateProviderConfig[] = [...llmProviders, ...filteredNonAPIProviders, ...pureAPIProviders]
  const currentProvider = allProviders.find(p => p.id === translateConfig.providerId)

  return (
    <Select<TranslateProviderConfig>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider)
          return
        void setTranslateConfig({
          providerId: provider.id,
        })
      }}
      itemToStringValue={p => p.id}
    >
      <SelectTrigger className={className}>
        <SelectValue>
          {(provider: TranslateProviderConfig) => (
            <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{i18n.t('translateService.aiTranslator')}</SelectLabel>
          {llmProviders.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>{i18n.t('translateService.normalTranslator')}</SelectLabel>
          {filteredNonAPIProviders.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            </SelectItem>
          ))}
          {pureAPIProviders.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
