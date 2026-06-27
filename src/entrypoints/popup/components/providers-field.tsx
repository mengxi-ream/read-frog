import type { Config } from "@/types/config/config"
import type { ProvidersConfig } from "@/types/config/provider"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { i18n } from "#imports"
import { HelpTooltip } from "@/components/help-tooltip"
import { FeatureProviderSelectorList } from "@/components/llm-providers/feature-provider-selector-list"
import { useTheme } from "@/components/providers/theme-provider"
import { Avatar, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button } from "@/components/ui/base-ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerTrigger } from "@/components/ui/base-ui/drawer"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { getProviderLogo, getProviderName } from "@/utils/providers/provider-display"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"

const VISIBLE_PROVIDER_COUNT = 5

function getSelectedProviderOptions(config: Config, providersConfig: ProvidersConfig) {
  const selectedProviders: ProviderSelectorOption[] = []

  const addProvider = (capability: ProviderCapability, providerId: string) => {
    const provider = getSelectableProvidersForCapability(capability, providersConfig)
      .find(provider => provider.id === providerId)
    if (!provider) {
      return
    }

    selectedProviders.push(provider)
  }

  for (const featureKey of FEATURE_KEYS) {
    addProvider(featureKey, FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config))
  }

  for (const action of config.selectionToolbar.customActions) {
    addProvider("selectionToolbar.customAction", action.providerId)
  }

  return selectedProviders
}

function ProviderAvatarSummary({ providers }: {
  providers: ProviderSelectorOption[]
}) {
  const { theme } = useTheme()
  const visibleProviders = providers.slice(0, VISIBLE_PROVIDER_COUNT)
  const remainingCount = providers.length - visibleProviders.length
  const providerKeyCounts = new Map<string, number>()

  return (
    <AvatarGroup>
      {visibleProviders.map((provider) => {
        const name = getProviderName(provider)
        const providerKeyCount = providerKeyCounts.get(provider.id) ?? 0
        providerKeyCounts.set(provider.id, providerKeyCount + 1)

        return (
          <Avatar key={`${provider.id}-${providerKeyCount}`} size="sm" className="items-center justify-center bg-white dark:bg-muted">
            <AvatarImage src={getProviderLogo(provider, theme)} alt={name} className="size-3.5 rounded-none object-contain" />
          </Avatar>
        )
      })}
      {remainingCount > 0 && (
        <AvatarGroupCount>
          {`+${remainingCount}`}
        </AvatarGroupCount>
      )}
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
          <HelpTooltip>
            {i18n.t("popup.providers.description")}
          </HelpTooltip>
        </span>
        <DrawerTrigger
          render={(
            <Button
              type="button"
              variant="ghost"
              aria-label={i18n.t("popup.providers.open")}
            />
          )}
        >
          <ProviderAvatarSummary providers={selectedProviders} />
        </DrawerTrigger>
      </div>
      <DrawerContent>
        <DrawerBody
          className="p-4"
          data-base-ui-swipe-ignore=""
        >
          <FeatureProviderSelectorList providerSelectorTriggerSize="sm" />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
