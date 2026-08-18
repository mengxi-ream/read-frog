import type { ComponentProps } from "react"
import type { Theme } from "@/types/config/theme"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { PlanBadge } from "@/components/badges/plan-badge"
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
import { i18n } from "@/utils/i18n"
import {
  getProviderLogo,
  getProviderName,
  isProviderSelectorOptionDisabled,
  isSystemProviderSelectorItem,
} from "@/utils/providers/provider-display"
import { useTheme } from "../providers/theme-provider"

type ProviderSelectorLabelKey =
  | "translateService.builtInModels"
  | "translateService.llmModels"
  | "translateService.normalTranslator"
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
  selectContentProps?: Pick<
    ComponentProps<typeof SelectContent>,
    "container" | "positionerClassName" | "align"
  >
}

export function getProviderSelectorGroups(
  providers: ProviderSelectorOption[],
): ProviderSelectorGroup[] {
  const builtInProviders = providers.filter(isSystemProviderSelectorItem)
  const llmProviders = providers.filter(
    (provider) => !isSystemProviderSelectorItem(provider) && isLLMProviderConfig(provider),
  )
  const pureTranslateProviders = providers.filter(
    (provider) =>
      !isSystemProviderSelectorItem(provider) && isPureTranslateProviderConfig(provider),
  )

  // Built-in models sit last: the user's own configured providers are the
  // primary choice, the hosted fallback the closing offer.
  const groups: ProviderSelectorGroup[] = [
    { labelKey: "translateService.llmModels", providers: llmProviders },
    { labelKey: "translateService.normalTranslator", providers: pureTranslateProviders },
    { labelKey: "translateService.builtInModels", providers: builtInProviders },
  ]

  return groups.filter((group) => group.providers.length > 0)
}

function ProviderOptionContent({
  provider,
  theme,
  tooltipContainer,
}: {
  provider: ProviderSelectorOption
  theme: Theme
  tooltipContainer?: ComponentProps<typeof PlanBadge>["tooltipContainer"]
}) {
  const requiresUltra = isSystemProviderSelectorItem(provider) && provider.requiresUltra === true

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <ProviderIcon
        logo={getProviderLogo(provider, theme)}
        name={getProviderName(provider)}
        size="sm"
      />
      {requiresUltra && (
        <PlanBadge
          plan="ultra"
          upgradeTooltip={i18n.t("hostedAi.ultraBadge.tooltip")}
          tooltipContainer={tooltipContainer}
        />
      )}
    </div>
  )
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
  const currentProvider = providers.find((p) => p.id === value)
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
  selectContentProps?: Pick<
    ComponentProps<typeof SelectContent>,
    "container" | "positionerClassName" | "align"
  >
  theme: Theme
}) {
  return (
    <Select<ProviderSelectorOption>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider) return
        onChange(provider.id)
      }}
      itemToStringValue={(p) => p.id}
    >
      <SelectTrigger className={className} size={triggerSize}>
        <SelectValue placeholder={placeholder}>
          {(provider: ProviderSelectorOption) => (
            <ProviderIcon
              logo={getProviderLogo(provider, theme)}
              name={getProviderName(provider)}
              size="sm"
            />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...selectContentProps}>
        {providerGroups.map((group) => (
          <SelectGroup key={group.labelKey}>
            <SelectLabel>{i18n.t(group.labelKey)}</SelectLabel>
            {group.providers.map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider}
                disabled={isProviderSelectorOptionDisabled(provider)}
              >
                <ProviderOptionContent
                  provider={provider}
                  theme={theme}
                  tooltipContainer={selectContentProps?.container}
                />
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
  selectContentProps?: Pick<
    ComponentProps<typeof SelectContent>,
    "container" | "positionerClassName" | "align"
  >
  theme: Theme
}) {
  return (
    <Select<ProviderSelectorOption>
      value={currentProvider}
      onValueChange={(provider) => {
        if (!provider) return
        onChange(provider.id)
      }}
      itemToStringValue={(p) => p.id}
      disabled={providers.length === 0}
    >
      <SelectTrigger className={className} size={triggerSize}>
        <SelectValue placeholder={placeholder}>
          {(provider: ProviderSelectorOption) => (
            <ProviderIcon
              logo={getProviderLogo(provider, theme)}
              name={getProviderName(provider)}
              size="sm"
            />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...selectContentProps}>
        <SelectGroup>
          {providers.map((provider) => (
            <SelectItem
              key={provider.id}
              value={provider}
              disabled={isProviderSelectorOptionDisabled(provider)}
            >
              <ProviderOptionContent
                provider={provider}
                theme={theme}
                tooltipContainer={selectContentProps?.container}
              />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
