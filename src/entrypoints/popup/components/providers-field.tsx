import type { Config } from "@/types/config/config"
import type { ProvidersConfig } from "@/types/config/provider"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { FeatureProviderSelectorList } from "@/components/llm-providers/feature-provider-selector-list"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { useTheme } from "@/components/providers/theme-provider"
import { Avatar, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button } from "@/components/ui/base-ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerTrigger } from "@/components/ui/base-ui/drawer"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { isProviderIdDurablyUnusable } from "@/utils/providers/provider-availability"
import { getProviderLogo, getProviderName } from "@/utils/providers/provider-display"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"

const VISIBLE_PROVIDER_COUNT = 5

/**
 * The capability travels with the provider because usability is per slot: the
 * same built-in can be runnable for one feature and walled off for another,
 * since the plan funds features individually.
 */
interface SelectedProviderSlot {
  provider: ProviderSelectorOption
  capability: ProviderCapability
}

function getSelectedProviderOptions(
  config: Config,
  providersConfig: ProvidersConfig,
): SelectedProviderSlot[] {
  const selectedProviders: SelectedProviderSlot[] = []

  const addProvider = (capability: ProviderCapability, providerId: string) => {
    const selectedProvider = getSelectableProvidersForCapability(capability, providersConfig).find(
      (providerOption) => providerOption.id === providerId,
    )
    if (!selectedProvider) {
      return
    }

    selectedProviders.push({ provider: selectedProvider, capability })
  }

  for (const featureKey of FEATURE_KEYS) {
    addProvider(featureKey, FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config))
  }

  for (const action of getSelectionToolbarActions(config.selectionToolbar)) {
    if (action.enabled === false) {
      continue
    }
    addProvider("customAction", action.providerId)
  }

  return selectedProviders
}

function ProviderAvatarSummary({ slots }: { slots: SelectedProviderSlot[] }) {
  const { theme } = useTheme()
  const { status } = useHostedAiStatus()
  const visibleSlots = slots.slice(0, VISIBLE_PROVIDER_COUNT)
  const remainingCount = slots.length - visibleSlots.length
  const providerKeyCounts = new Map<string, number>()

  return (
    <AvatarGroup>
      {visibleSlots.map(({ provider, capability }) => {
        const name = getProviderName(provider)
        const providerKeyCount = providerKeyCounts.get(provider.id) ?? 0
        providerKeyCounts.set(provider.id, providerKeyCount + 1)
        // Same treatment and the same predicate as the dropdowns this button
        // opens: dimmed on durable account facts only, so a row the user could
        // fix by signing in or upgrading reads differently from one that is
        // merely out of quota. Otherwise these logos say "five features
        // configured" to an account that can run none of them.
        const unusable = isProviderIdDurablyUnusable(provider.id, capability, status)

        return (
          <Avatar
            key={`${provider.id}-${providerKeyCount}`}
            size="sm"
            className="items-center justify-center bg-white dark:bg-muted"
          >
            <AvatarImage
              src={getProviderLogo(provider, theme)}
              alt={name}
              className={`size-3.5 rounded-none object-contain${unusable ? " opacity-40 grayscale" : ""}`}
            />
          </Avatar>
        )
      })}
      {remainingCount > 0 && <AvatarGroupCount>{`+${remainingCount}`}</AvatarGroupCount>}
    </AvatarGroup>
  )
}

export default function ProvidersField() {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const selectedProviders = useMemo(
    () => getSelectedProviderOptions(config, providersConfig),
    [config, providersConfig],
  )

  return (
    <Drawer>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium">
          {i18n.t("popup.providers.title")}
          <HelpTooltip>{i18n.t("popup.providers.description")}</HelpTooltip>
        </span>
        <DrawerTrigger
          render={
            <Button type="button" variant="ghost" aria-label={i18n.t("popup.providers.open")} />
          }
        >
          <ProviderAvatarSummary slots={selectedProviders} />
        </DrawerTrigger>
      </div>
      <DrawerContent>
        <DrawerBody className="p-4" data-base-ui-swipe-ignore="">
          <FeatureProviderSelectorList providerSelectorTriggerSize="sm" />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
