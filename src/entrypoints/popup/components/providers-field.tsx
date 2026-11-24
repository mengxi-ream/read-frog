import type { Config } from "@/types/config/config"
import type { ProvidersConfig } from "@/types/config/provider"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { BuiltInAiModelList, ProviderCapability } from "@/utils/providers/provider-registry"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { FeatureProviderSelectorList } from "@/components/llm-providers/feature-provider-selector-list"
import { getModelVendorLogo } from "@/components/llm-providers/model-icon"
import { useBuiltInAiModels } from "@/components/llm-providers/use-built-in-ai-models"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { useTheme } from "@/components/providers/theme-provider"
import { Avatar, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button } from "@/components/ui/base-ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerTrigger } from "@/components/ui/base-ui/drawer"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { FEATURE_PROVIDER_DEFS, getShownFeatureKeys } from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { isFeatureOn } from "@/utils/features"
import { i18n } from "@/utils/i18n"
import { isProviderIdPlanWalled } from "@/utils/providers/provider-availability"
import {
  getProviderLogo,
  getProviderName,
  isSystemProviderSelectorItem,
} from "@/utils/providers/provider-display"
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
  builtInAiModels: BuiltInAiModelList,
): SelectedProviderSlot[] {
  const selectedProviders: SelectedProviderSlot[] = []

  const addProvider = (capability: ProviderCapability, providerId: string) => {
    const selectedProvider = getSelectableProvidersForCapability(
      capability,
      providersConfig,
      builtInAiModels,
      [providerId],
    ).find((providerOption) => providerOption.id === providerId)
    if (!selectedProvider) {
      return
    }

    selectedProviders.push({ provider: selectedProvider, capability })
  }

  // Same rows as the drawer this summarizes: none for a feature simple mode turned off.
  for (const featureKey of getShownFeatureKeys(config)) {
    addProvider(featureKey, FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config))
  }

  const actions = isFeatureOn(config, "customActions")
    ? getSelectionToolbarActions(config.selectionToolbar)
    : []
  for (const action of actions) {
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
        // opens: dimmed only behind a plan the account lacks, so a row the user
        // has to upgrade for reads differently from one that is merely out of
        // quota or waiting for a guest to sign in. Otherwise these logos say
        // "five features configured" to an account that can run none of them.
        const unusable = isProviderIdPlanWalled(provider.id, capability, status)
        // A Built-in AI model shows its vendor's logo, as in the menus, but
        // without the frog badge: the next avatar would cover it. A model whose
        // vendor is unknown keeps the frog.
        const logo =
          (isSystemProviderSelectorItem(provider)
            ? getModelVendorLogo(provider.vendor, theme)
            : null) ?? getProviderLogo(provider, theme)

        return (
          <Avatar
            key={`${provider.id}-${providerKeyCount}`}
            size="sm"
            className="items-center justify-center bg-white dark:bg-muted"
          >
            <AvatarImage
              src={logo}
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
  const { models: builtInAiModels } = useBuiltInAiModels()

  const selectedProviders = useMemo(
    () => getSelectedProviderOptions(config, providersConfig, builtInAiModels),
    [config, providersConfig, builtInAiModels],
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
