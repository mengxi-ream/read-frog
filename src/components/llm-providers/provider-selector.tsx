import type { ComponentProps } from "react"
import type { Theme } from "@/types/config/theme"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
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
import { getProviderLogo, getProviderName, isProviderSelectorItem } from "@/utils/providers/provider-display"
import { useTheme } from "../providers/theme-provider"

type ProviderSelectorLabelKey = "translateService.builtInModels" | "translateService.llmModels" | "translateService.normalTranslator"
type ProviderSelectorTriggerSize = ComponentProps<typeof SelectTrigger>["size"]

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
  triggerSize?: ProviderSelectorTriggerSize
  selectContentProps?: Pick<ComponentProps<typeof SelectContent>, "container" | "positionerClassName">
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
  triggerSize = "default",
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
        triggerSize={triggerSize}
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
      triggerSize={triggerSize}
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
  triggerSize,
  theme,
  selectContentProps,
}: {
  providerGroups: ProviderSelectorGroup[]
  currentProvider: ProviderSelectorOption | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  triggerSize: ProviderSelectorTriggerSize
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
      <SelectTrigger className={className} size={triggerSize}>
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
  triggerSize,
  theme,
  selectContentProps,
}: {
  providers: ProviderSelectorOption[]
  currentProvider: ProviderSelectorOption | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  triggerSize: ProviderSelectorTriggerSize
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
      <SelectTrigger className={className} size={triggerSize}>
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
