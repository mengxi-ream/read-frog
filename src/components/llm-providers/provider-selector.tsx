import type { Theme } from '@/components/providers/theme-provider'
import type { ProviderConfig, TranslateProviderConfig } from '@/types/config/provider'
import type { FeatureKey } from '@/utils/constants/feature-providers'
import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
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
import { NON_API_TRANSLATE_PROVIDERS } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getLLMProvidersConfig, getNonAPIProvidersConfig, getPureAPIProvidersConfig } from '@/utils/config/helpers'
import { FEATURE_PROVIDER_DEFS } from '@/utils/constants/feature-providers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { useTheme } from '../providers/theme-provider'

interface ProviderSelectorProps {
  featureKey: FeatureKey
  value: string | null
  onChange: (id: string) => void
  nullable?: boolean
  excludeProviderTypes?: string[]
  placeholder?: string
  className?: string
}

export default function ProviderSelector({
  featureKey,
  value,
  onChange,
  excludeProviderTypes,
  placeholder,
  className,
}: ProviderSelectorProps) {
  const { theme } = useTheme()
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const enabledProvidersConfig = filterEnabledProvidersConfig(providersConfig)

  const def = FEATURE_PROVIDER_DEFS[featureKey]
  const allProviders = enabledProvidersConfig
    .filter(p => def.isProvider(p.provider))
    .filter(p => !excludeProviderTypes?.includes(p.provider))

  const currentProvider = allProviders.find(p => p.id === value)

  const hasNonAPI = NON_API_TRANSLATE_PROVIDERS.some(t => def.isProvider(t))
  if (hasNonAPI) {
    return (
      <TranslateGroupedSelect
        enabledProvidersConfig={enabledProvidersConfig}
        excludeProviderTypes={excludeProviderTypes}
        currentProvider={currentProvider}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        theme={theme}
      />
    )
  }

  return (
    <FlatSelect
      providers={allProviders}
      currentProvider={currentProvider}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      theme={theme}
    />
  )
}

function TranslateGroupedSelect({
  enabledProvidersConfig,
  excludeProviderTypes,
  currentProvider,
  onChange,
  placeholder,
  className,
  theme,
}: {
  enabledProvidersConfig: ProviderConfig[]
  excludeProviderTypes?: string[]
  currentProvider: ProviderConfig | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  theme: Theme
}) {
  const nonAPIProviders = getNonAPIProvidersConfig(enabledProvidersConfig)
    .filter(p => !excludeProviderTypes?.includes(p.provider))
  const llmProviders = getLLMProvidersConfig(enabledProvidersConfig)
  const pureAPIProviders = getPureAPIProvidersConfig(enabledProvidersConfig)

  return (
    <Select<TranslateProviderConfig>
      value={currentProvider as TranslateProviderConfig | undefined}
      onValueChange={(provider) => {
        if (!provider)
          return
        onChange(provider.id)
      }}
      itemToStringValue={p => p.id}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {(provider: TranslateProviderConfig) => (
            <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-fit">
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
          {nonAPIProviders.map(provider => (
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

function FlatSelect({
  providers,
  currentProvider,
  onChange,
  placeholder,
  className,
  theme,
}: {
  providers: ProviderConfig[]
  currentProvider: ProviderConfig | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  theme: Theme
}) {
  return (
    <Select<ProviderConfig>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider)
          return
        onChange(provider.id)
      }}
      itemToStringValue={p => p.id}
      disabled={providers.length === 0}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {(provider: ProviderConfig) => (
            <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-fit">
        <SelectGroup>
          {providers.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
