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

export interface ProviderSelectorItem {
  kind: "system"
  id: string
  logo: (theme: Theme) => string
  name: string
}

export type ProviderSelectorOption = ProviderConfig | ProviderSelectorItem
type ProviderSelectorLabelKey = "translateService.builtInModels" | "translateService.llmModels" | "translateService.normalTranslator"

export interface ProviderSelectorGroup {
  labelKey: ProviderSelectorLabelKey
  providers: ProviderSelectorOption[]
}

interface ProviderSelectorProps {
  providers: ProviderSelectorOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
}

function isProviderSelectorItem(provider: ProviderSelectorOption): provider is ProviderSelectorItem {
  return "kind" in provider && provider.kind === "system"
}

function getProviderLogo(provider: ProviderSelectorOption, theme: Theme): string {
  return isProviderSelectorItem(provider)
    ? provider.logo(theme)
    : PROVIDER_ITEMS[provider.provider].logo(theme)
}

function getProviderName(provider: ProviderSelectorOption): string {
  return provider.name
}

export function getProviderSelectorGroups(providers: ProviderSelectorOption[]): ProviderSelectorGroup[] {
  const builtInProviders = providers.filter(isProviderSelectorItem)
  const llmProviders = providers.filter(provider =>
    !isProviderSelectorItem(provider) && isLLMProviderConfig(provider),
  )
  const pureTranslateProviders = providers.filter(provider =>
    !isProviderSelectorItem(provider) && isPureTranslateProviderConfig(provider),
  )

  const groups: ProviderSelectorGroup[] = [
    { labelKey: "translateService.builtInModels", providers: builtInProviders },
    { labelKey: "translateService.llmModels", providers: llmProviders },
    { labelKey: "translateService.normalTranslator", providers: pureTranslateProviders },
  ]

  return groups.filter(group => group.providers.length > 0)
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
  const providerGroups = getProviderSelectorGroups(providers)

  if (providerGroups.length > 1) {
    return (
      <GroupedSelect
        providerGroups={providerGroups}
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
    <UngroupedSelect
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

function GroupedSelect({
  providerGroups,
  currentProvider,
  onChange,
  placeholder,
  className,
  theme,
  selectContentProps,
}: {
  providerGroups: ProviderSelectorGroup[]
  currentProvider: ProviderSelectorOption | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
  theme: Theme
}) {
  return (
    <Select<ProviderSelectorOption>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider)
          return
        onChange(provider.id)
      }}
      itemToStringValue={p => p.id}
    >
      <SelectTrigger className={className} size="sm">
        <SelectValue placeholder={placeholder}>
          {(provider: ProviderSelectorOption) => (
            <ProviderIcon logo={getProviderLogo(provider, theme)} name={getProviderName(provider)} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-fit" {...selectContentProps}>
        {providerGroups.map(group => (
          <SelectGroup key={group.labelKey}>
            <SelectLabel>{i18n.t(group.labelKey)}</SelectLabel>
            {group.providers.map(provider => (
              <SelectItem key={provider.id} value={provider}>
                <ProviderIcon logo={getProviderLogo(provider, theme)} name={getProviderName(provider)} size="sm" />
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function UngroupedSelect({
  providers,
  currentProvider,
  onChange,
  placeholder,
  className,
  theme,
  selectContentProps,
}: {
  providers: ProviderSelectorOption[]
  currentProvider: ProviderSelectorOption | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
  theme: Theme
}) {
  return (
    <Select<ProviderSelectorOption>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider)
          return
        onChange(provider.id)
      }}
      itemToStringValue={p => p.id}
      disabled={providers.length === 0}
    >
      <SelectTrigger className={className} size="sm">
        <SelectValue placeholder={placeholder}>
          {(provider: ProviderSelectorOption) => (
            <ProviderIcon logo={getProviderLogo(provider, theme)} name={getProviderName(provider)} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-fit" {...selectContentProps}>
        <SelectGroup>
          {providers.map(provider => (
            <SelectItem key={provider.id} value={provider}>
              <ProviderIcon logo={getProviderLogo(provider, theme)} name={getProviderName(provider)} size="sm" />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
