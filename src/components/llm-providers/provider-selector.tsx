import type { ComponentProps } from "react"
import type { ProviderConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import { i18n } from "#imports"
import ProviderIcon from "@/components/provider-icon"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { isLLMProviderConfig, isPureTranslateProviderConfig } from "@/types/config/provider"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { useTheme } from "../providers/theme-provider"

interface ProviderSelectorProps {
  providers: ProviderConfig[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
}

export default function ProviderSelector({
  providers,
  value,
  onChange,
  placeholder,
  className,
  selectContentProps,
}: ProviderSelectorProps) {
  const { theme } = useTheme()
  const currentProvider = providers.find(p => p.id === value)

  const hasGrouping = providers.some(isPureTranslateProviderConfig)
  if (hasGrouping) {
    return (
      <TranslateGroupedSelect
        providers={providers}
        currentProvider={currentProvider}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        selectContentProps={selectContentProps}
        theme={theme}
      />
    )
  }

  return (
    <FlatSelect
      providers={providers}
      currentProvider={currentProvider}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      selectContentProps={selectContentProps}
      theme={theme}
    />
  )
}

function TranslateGroupedSelect({
  providers,
  currentProvider,
  onChange,
  placeholder,
  className,
  theme,
  selectContentProps,
}: {
  providers: ProviderConfig[]
  currentProvider: ProviderConfig | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
  theme: Theme
}) {
  const llmProviders = providers.filter(isLLMProviderConfig)
  const pureTranslateProviders = providers.filter(isPureTranslateProviderConfig)

  return (
    <Select<ProviderConfig>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider)
          return
        onChange(provider.id)
      }}
      itemToStringValue={p => p.id}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {(provider: ProviderConfig) => (
            <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-fit" {...selectContentProps}>
        <SelectGroup>
          <SelectLabel>{i18n.t("translateService.aiTranslator")}</SelectLabel>
          {llmProviders.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={PROVIDER_ITEMS[provider.provider].logo(theme)} name={provider.name} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>{i18n.t("translateService.normalTranslator")}</SelectLabel>
          {pureTranslateProviders.map(provider => (
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
  selectContentProps,
}: {
  providers: ProviderConfig[]
  currentProvider: ProviderConfig | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
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
      <SelectContent className="min-w-fit" {...selectContentProps}>
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
