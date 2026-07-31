import type { APIProviderConfig } from "@/types/config/provider"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { SponsorBadge } from "@/components/badges/sponsor-badge"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { anchoredToastManager } from "@/components/ui/base-ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { isAPIProviderConfig } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { providerConfigAtom } from "@/utils/atoms/provider"
import { getAPIProvidersConfig, getProviderConfigById } from "@/utils/config/helpers"
import {
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { API_PROVIDER_ITEMS } from "@/utils/constants/providers"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { getRequestedProviderId, PROVIDER_CONFIG_SECTION_ID } from "@/utils/navigation"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_PROVIDER_LOGO,
  isBuiltInAiProviderId,
} from "@/utils/providers/provider-registry"
import { ConfigItem } from "../../../components/config-item"
import { EntityEditor } from "../../../components/entity-editor"
import { EntityEditorLayout } from "../../../components/entity-editor-layout"
import { EntityListItem } from "../../../components/entity-list-item"
import { EntityListRail } from "../../../components/entity-list-rail"
import AddProviderDialog from "./add-provider-dialog"
import { selectedProviderIdAtom } from "./atoms"
import { ProviderConfigForm } from "./provider-config-form"
import { BuiltInProviderEditor, ProviderEditor } from "./provider-editor"

/**
 * Opens the provider named by a `?provider=` deep link, the one an API-key prompt elsewhere on
 * the page points at. Keyed on the history entry so the same link works twice, and held back
 * until the id resolves so a link followed before the config loads is not dropped.
 */
function useRequestedProvider() {
  const { search, key: locationKey } = useLocation()
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setSelectedProviderId = useSetAtom(selectedProviderIdAtom)
  const handledLocationRef = useRef<string | null>(null)

  useEffect(() => {
    const marker = `${locationKey}:${search}`
    if (handledLocationRef.current === marker) return

    const providerId = getRequestedProviderId(search)
    if (!providerId) return
    if (!isBuiltInAiProviderId(providerId) && !getProviderConfigById(providersConfig, providerId)) {
      return
    }

    handledLocationRef.current = marker
    setSelectedProviderId(providerId)
  }, [locationKey, search, providersConfig, setSelectedProviderId])
}

export function ProvidersConfig() {
  const selectedProviderId = useAtomValue(selectedProviderIdAtom)
  useRequestedProvider()
  const editor =
    selectedProviderId === BUILT_IN_AI_PROVIDER_ID ? (
      <BuiltInProviderPanel />
    ) : (
      <ProviderConfigForm key={selectedProviderId} />
    )

  return (
    <ConfigItem
      id={PROVIDER_CONFIG_SECTION_ID}
      orientation="vertical"
      title={i18n.t("options.apiProviders.configTitle")}
      description={i18n.t("options.apiProviders.description")}
    >
      <EntityEditorLayout list={<ProviderCardList />} editor={editor} />
    </ConfigItem>
  )
}

function ProviderCardList() {
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const apiProvidersConfig = getAPIProvidersConfig(providersConfig)
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const didLockInitialSelectionRef = useRef(false)

  const handleReorder = (newList: APIProviderConfig[]) => {
    const desiredOrderIds = newList.map((provider) => provider.id)
    const desiredOrderIdSet = new Set(desiredOrderIds)

    const nonApiProviders = providersConfig.filter((provider) => !isAPIProviderConfig(provider))
    const currentApiProviders = providersConfig.filter(isAPIProviderConfig)

    const apiProvidersById = new Map(
      currentApiProviders.map((provider) => [provider.id, provider] as const),
    )

    const reorderedApiProviders: APIProviderConfig[] = []
    for (const id of desiredOrderIds) {
      const provider = apiProvidersById.get(id)
      if (provider) reorderedApiProviders.push(provider)
    }

    // Preserve any API providers that appeared while dragging (e.g. config sync)
    for (const provider of currentApiProviders) {
      if (!desiredOrderIdSet.has(provider.id)) {
        reorderedApiProviders.push(provider)
      }
    }

    void setProvidersConfig([...nonApiProviders, ...reorderedApiProviders])
  }

  useEffect(() => {
    if (didLockInitialSelectionRef.current) return
    if (selectedProviderId) {
      setSelectedProviderId(selectedProviderId)
      didLockInitialSelectionRef.current = true
    }
  }, [selectedProviderId, setSelectedProviderId])

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="h-auto rounded-xl border-dashed p-3"
              onClick={() => setIsAddDialogOpen(true)}
            />
          }
        >
          <div className="flex w-full items-center justify-center gap-2">
            <Icon icon="tabler:plus" className="size-4" />
            <span className="text-sm">{i18n.t("options.apiProviders.addProvider")}</span>
          </div>
        </DialogTrigger>
        <AddProviderDialog onClose={() => setIsAddDialogOpen(false)} />
      </Dialog>
      <EntityListRail>
        <SortableList
          list={apiProvidersConfig}
          setList={handleReorder}
          className="flex flex-col gap-4 pt-2"
          renderItem={(providerConfig) => <ProviderCard providerConfig={providerConfig} />}
        />
      </EntityListRail>
      <BuiltInProviderSection />
    </div>
  )
}

function ProviderCard({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { id, name, provider, enabled } = providerConfig
  const { theme } = useTheme()
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const setProviderConfig = useSetAtom(providerConfigAtom(id))
  const config = useAtomValue(configAtom)
  const sponsor = API_PROVIDER_ITEMS[provider].sponsor
  const switchRef = useRef<HTMLButtonElement>(null)

  const assignedFeatures = FEATURE_KEYS.filter(
    (key) => FEATURE_PROVIDER_DEFS[key].getProviderId(config) === id,
  )
  const assignedCustomActions = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.providerId === id,
  )
  const isLanguageDetectionProvider =
    config.languageDetection.mode === "llm" && config.languageDetection.providerId === id
  const totalAssigned =
    assignedFeatures.length + assignedCustomActions.length + (isLanguageDetectionProvider ? 1 : 0)

  const handleProviderEnabledChange = (checked: boolean) => {
    if (!checked && enabled && totalAssigned > 0) {
      if (!switchRef.current) return

      anchoredToastManager.add({
        id: `provider-disable-${id}`,
        positionerProps: {
          anchor: switchRef.current,
          sideOffset: 6,
        },
        type: "error",
        title: i18n.t("options.apiProviders.form.providerInUseCannotDisable", [
          name,
          totalAssigned,
        ]),
      })
      return
    }

    void setProviderConfig({ ...providerConfig, enabled: checked })
  }

  return (
    <EntityListItem.Root
      data-provider-id={id}
      selected={selectedProviderId === id}
      onClick={() => setSelectedProviderId(id)}
    >
      <EntityListItem.Badges>
        <>
          {sponsor?.sponsoring && <SponsorBadge className="absolute -top-2 left-2 text-[10px]" />}
          <FeatureCountBadge count={totalAssigned}>
            {assignedFeatures.map((key) => (
              <li key={key}>{i18n.t(getFeatureLabelI18nKey(key))}</li>
            ))}
            {isLanguageDetectionProvider && (
              <li>{i18n.t("options.apiProviders.languageDetection.title")}</li>
            )}
            {assignedCustomActions.map((action) => (
              <li key={action.id}>{action.name}</li>
            ))}
          </FeatureCountBadge>
        </>
      </EntityListItem.Badges>
      <EntityListItem.Content>
        <ProviderIcon
          logo={API_PROVIDER_ITEMS[provider].logo(theme)}
          name={name}
          size="base"
          textClassName="text-sm"
        />
        <EntityListItem.Toggle
          ref={switchRef}
          aria-label={name}
          checked={enabled}
          onCheckedChange={handleProviderEnabledChange}
        />
      </EntityListItem.Content>
    </EntityListItem.Root>
  )
}

function FeatureCountBadge({ count, children }: { count: number; children: React.ReactNode }) {
  if (count === 0) {
    return null
  }

  return (
    <div className="absolute -top-2 right-2 flex items-center justify-center gap-1">
      <Tooltip>
        <TooltipTrigger render={<Badge className="cursor-default bg-blue-500" size="sm" />}>
          {i18n.t("options.apiProviders.badges.featureCount", [count])}
        </TooltipTrigger>
        <TooltipContent>
          <ul className="list-inside list-disc marker:text-green-500">{children}</ul>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function BuiltInProviderSection() {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const config = useAtomValue(configAtom)
  const providerName = i18n.t("options.apiProviders.providers.name.builtInAi")
  const assignedCustomActions = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.providerId === BUILT_IN_AI_PROVIDER_ID,
  )

  return (
    <section className="flex flex-col gap-2 pt-1">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">
        {i18n.t("options.apiProviders.builtInProvider" as never)}
      </h3>
      <EntityListItem.Root
        data-provider-id={BUILT_IN_AI_PROVIDER_ID}
        selected={selectedProviderId === BUILT_IN_AI_PROVIDER_ID}
        onClick={() => setSelectedProviderId(BUILT_IN_AI_PROVIDER_ID)}
      >
        <EntityListItem.Badges>
          <FeatureCountBadge count={assignedCustomActions.length}>
            {assignedCustomActions.map((action) => (
              <li key={action.id}>{action.name}</li>
            ))}
          </FeatureCountBadge>
        </EntityListItem.Badges>
        <EntityListItem.Content>
          <ProviderIcon
            logo={BUILT_IN_AI_PROVIDER_LOGO}
            name={providerName}
            size="base"
            textClassName="text-sm"
          />
          <EntityListItem.Toggle aria-label={providerName} checked disabled />
        </EntityListItem.Content>
      </EntityListItem.Root>
    </section>
  )
}

function BuiltInProviderPanel() {
  const atlasCloudProvider = API_PROVIDER_ITEMS.atlascloud
  const atlasCloudUrl = atlasCloudProvider.sponsor?.referUrl ?? atlasCloudProvider.website

  return (
    <BuiltInProviderEditor.Provider>
      <EntityEditor.Root>
        <EntityEditor.Body className="gap-6">
          <div className="flex flex-col gap-4">
            <ProviderEditor.Identity />
            <div className="flex flex-col items-start gap-3">
              <ProviderEditor.Attribution>
                {i18n.t("options.apiProviders.providers.attribution.builtInAi" as never)}
              </ProviderEditor.Attribution>
              <ProviderEditor.SponsorCTA href={atlasCloudUrl}>
                {i18n.t("options.apiProviders.sponsorCta")}
              </ProviderEditor.SponsorCTA>
            </div>
          </div>
          <ProviderEditor.Assignments defaultOpen>
            <ProviderEditor.CustomActionAssignments />
          </ProviderEditor.Assignments>
        </EntityEditor.Body>
      </EntityEditor.Root>
    </BuiltInProviderEditor.Provider>
  )
}
