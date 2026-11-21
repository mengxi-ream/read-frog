import type { ComponentProps } from "react"
import type { Theme } from "@/types/config/theme"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { UpgradePlanBadge } from "@/components/badges/upgrade-plan-badge"
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
import { getHostedAiModelUnavailableReason } from "@/utils/hosted-ai/model-errors"
import { i18n } from "@/utils/i18n"
import {
  getBuiltInAiAlternativeNames,
  getBuiltInAiUnavailability,
  getProviderName,
  isProviderSelectorOptionDisabled,
  isSystemProviderSelectorItem,
} from "@/utils/providers/provider-display"
import { cn } from "@/utils/styles/utils"
import { useTheme } from "../providers/theme-provider"
import { ProviderOptionIcon } from "./model-icon"
import { ModelUnavailableIcon } from "./model-unavailable-icon"

type ProviderSelectorLabelKey =
  | "translateService.builtInModels"
  | "translateService.llmModels"
  | "translateService.normalTranslator"
type ProviderSelectorTriggerSize = ComponentProps<typeof SelectTrigger>["size"]
/**
 * Where a row's tooltips portal to, and the classes for their positioner: the
 * menu's own `container` and `positionerClassName`, so that inside the
 * selection popover they paint on its overlay layer, not under it.
 */
interface TooltipLayer {
  container?: ComponentProps<typeof UpgradePlanBadge>["tooltipContainer"]
  positionerClassName?: string
}

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
  /** Applied to the selected provider's name in the trigger, not to the list items. */
  triggerNameClassName?: string
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

  // Built-in models lead, then machine translators, then the user's own LLM providers.
  const groups: ProviderSelectorGroup[] = [
    { labelKey: "translateService.builtInModels", providers: builtInProviders },
    { labelKey: "translateService.normalTranslator", providers: pureTranslateProviders },
    { labelKey: "translateService.llmModels", providers: llmProviders },
  ]

  return groups.filter((group) => group.providers.length > 0)
}

/**
 * Why a Built-in AI option cannot run and what to pick instead, or undefined
 * when it can. `providers` is the whole menu, which the alternatives come from.
 */
function getUnavailableReason(
  provider: ProviderSelectorOption,
  providers: readonly ProviderSelectorOption[],
): string | undefined {
  const unavailability = getBuiltInAiUnavailability(provider)
  if (!unavailability) {
    return undefined
  }
  return getHostedAiModelUnavailableReason(
    getProviderName(provider),
    unavailability,
    getBuiltInAiAlternativeNames(provider, providers),
  )
}

/** One option's row in a provider menu: its icon and name, then why it cannot run or which plan it needs. */
export function ProviderOptionContent({
  provider,
  providers,
  theme,
  tooltipLayer,
}: {
  provider: ProviderSelectorOption
  providers: readonly ProviderSelectorOption[]
  theme: Theme
  tooltipLayer?: TooltipLayer
}) {
  const upgradeTo = isSystemProviderSelectorItem(provider) ? provider.upgradeTo : undefined
  const unavailableReason = getUnavailableReason(provider, providers)

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <ProviderOptionIcon
        provider={provider}
        theme={theme}
        textClassName={cn(unavailableReason && "text-muted-foreground")}
      />
      {(unavailableReason || upgradeTo) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Still selectable: picking it is the user's call, and it fails with this reason when it runs. */}
          {unavailableReason && (
            <ModelUnavailableIcon
              reason={unavailableReason}
              tooltipContainer={tooltipLayer?.container}
              tooltipPositionerClassName={tooltipLayer?.positionerClassName}
            />
          )}
          {upgradeTo && (
            <UpgradePlanBadge
              plan={upgradeTo}
              tooltipContainer={tooltipLayer?.container}
              tooltipPositionerClassName={tooltipLayer?.positionerClassName}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ProviderSelectValue({
  providers,
  placeholder,
  theme,
  triggerNameClassName,
  tooltipLayer,
}: {
  providers: readonly ProviderSelectorOption[]
  placeholder?: string
  theme: Theme
  triggerNameClassName?: string
  tooltipLayer?: TooltipLayer
}) {
  return (
    // The trigger clamps its value to one line with overflow hidden, which
    // would clip a model icon's frog where it overhangs the circle. The name
    // still truncates: it does so itself, given the room to shrink.
    <SelectValue placeholder={placeholder} className="min-w-0 overflow-visible!">
      {(provider: ProviderSelectorOption | null) => {
        if (!provider) {
          return placeholder
        }
        const unavailableReason = getUnavailableReason(provider, providers)
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            <ProviderOptionIcon
              provider={provider}
              theme={theme}
              textClassName={triggerNameClassName}
            />
            {unavailableReason && (
              <ModelUnavailableIcon
                reason={unavailableReason}
                tooltipContainer={tooltipLayer?.container}
                tooltipPositionerClassName={tooltipLayer?.positionerClassName}
              />
            )}
          </span>
        )
      }}
    </SelectValue>
  )
}

export default function ProviderSelector({
  providers,
  value,
  onChange,
  placeholder,
  className,
  triggerNameClassName,
  triggerSize = "default",
  selectContentProps,
}: ProviderSelectorProps) {
  const { theme } = useTheme()
  const currentProvider = providers.find((p) => p.id === value)
  const providerGroups = getProviderSelectorGroups(providers)

  if (providerGroups.length > 1) {
    return (
      <GroupedSelect
        providers={providers}
        providerGroups={providerGroups}
        currentProvider={currentProvider}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        triggerNameClassName={triggerNameClassName}
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
      triggerNameClassName={triggerNameClassName}
      triggerSize={triggerSize}
      selectContentProps={selectContentProps}
      theme={theme}
    />
  )
}

function GroupedSelect({
  providers,
  providerGroups,
  currentProvider,
  onChange,
  placeholder,
  className,
  triggerNameClassName,
  triggerSize,
  theme,
  selectContentProps,
}: {
  providers: ProviderSelectorOption[]
  providerGroups: ProviderSelectorGroup[]
  currentProvider: ProviderSelectorOption | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  triggerNameClassName?: string
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
        <ProviderSelectValue
          providers={providers}
          placeholder={placeholder}
          theme={theme}
          triggerNameClassName={triggerNameClassName}
          tooltipLayer={selectContentProps}
        />
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
                  providers={providers}
                  theme={theme}
                  tooltipLayer={selectContentProps}
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
  triggerNameClassName,
  triggerSize,
  theme,
  selectContentProps,
}: {
  providers: ProviderSelectorOption[]
  currentProvider: ProviderSelectorOption | undefined
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  triggerNameClassName?: string
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
        <ProviderSelectValue
          providers={providers}
          placeholder={placeholder}
          theme={theme}
          triggerNameClassName={triggerNameClassName}
          tooltipLayer={selectContentProps}
        />
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
                providers={providers}
                theme={theme}
                tooltipLayer={selectContentProps}
              />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
