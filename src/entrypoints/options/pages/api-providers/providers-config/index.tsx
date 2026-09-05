import type { APIProviderConfig } from "@/types/config/provider"
import type { HostedAiFeature } from "@/utils/hosted-ai/types"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { SponsorBadge } from "@/components/badges/sponsor-badge"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { anchoredToastManager } from "@/components/ui/base-ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { isAPIProvider, isAPIProviderConfig } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { patchProviderConfigAtom } from "@/utils/atoms/entity-config"
import { getAPIProvidersConfig, getProviderConfigById } from "@/utils/config/helpers"
import {
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { BUILT_IN_AI_PROVIDER_IDS, type BuiltInAiProviderId } from "@/utils/constants/provider-ids"
import { API_PROVIDER_ITEMS } from "@/utils/constants/providers"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import { i18n } from "@/utils/i18n"
import {
  getRequestedProviderId,
  getRequestedProviderType,
  PROVIDER_CONFIG_SECTION_ID,
  shouldHighlightApiKey,
} from "@/utils/navigation"
import { isDurablyUnusableTier } from "@/utils/providers/provider-availability"
import {
  BUILT_IN_AI_PROVIDER_LOGO,
  BUILT_IN_AI_ADVANCE_PROVIDER_ID,
  getBuiltInAiProviderName,
  isBuiltInAiProviderId,
} from "@/utils/providers/provider-registry"
import { ConfigItem } from "../../../components/config-item"
import { EntityEditor } from "../../../components/entity-editor"
import { EntityEditorLayout } from "../../../components/entity-editor-layout"
import { EntityListItem } from "../../../components/entity-list-item"
import { EntityListRail } from "../../../components/entity-list-rail"
import AddProviderDialog from "./add-provider-dialog"
import { highlightedProviderFieldAtom, selectedProviderIdAtom } from "./atoms"
import { ProviderConfigForm } from "./provider-config-form"
import { BuiltInProviderEditor, ProviderEditor } from "./provider-editor"
import { addProvider } from "./utils"

/**
 * Opens the provider a deep link points at — by `?provider=` id, the one an API-key prompt
 * elsewhere on the page uses, or by `?providerType=` for links written by someone who cannot know
 * the id, such as a provider's own site. A type with no provider behind it gets one created.
 *
 * Keyed on the history entry so the same link works twice, and an id is held back until it
 * resolves so a link followed before the config loads is not dropped.
 */
function useRequestedProvider() {
  const { search, key: locationKey } = useLocation()
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const setSelectedProviderId = useSetAtom(selectedProviderIdAtom)
  const setHighlightedField = useSetAtom(highlightedProviderFieldAtom)
  const handledLocationRef = useRef<string | null>(null)

  useEffect(() => {
    const marker = `${locationKey}:${search}`
    if (handledLocationRef.current === marker) return

    const highlightRequestedField = () => {
      if (shouldHighlightApiKey(search)) {
        setHighlightedField("apiKey")
      }
    }

    const providerId = getRequestedProviderId(search)
    if (providerId) {
      if (
        !isBuiltInAiProviderId(providerId) &&
        !getProviderConfigById(providersConfig, providerId)
      ) {
        return
      }

      handledLocationRef.current = marker
      void setSelectedProviderId(providerId)
      highlightRequestedField()
      return
    }

    const requestedType = getRequestedProviderType(search)
    if (!requestedType || !isAPIProvider(requestedType)) return

    // Claimed before anything awaits: adding a provider rewrites the config this effect reads,
    // and React's development double-invoke runs it a second time. Either would add a duplicate.
    handledLocationRef.current = marker

    const existingProvider = getAPIProvidersConfig(providersConfig).find(
      (provider) => provider.provider === requestedType,
    )
    if (existingProvider) {
      void setSelectedProviderId(existingProvider.id)
      highlightRequestedField()
      return
    }

    void addProvider(
      requestedType,
      providersConfig,
      setProvidersConfig,
      setSelectedProviderId,
    ).then(highlightRequestedField)
  }, [
    locationKey,
    search,
    providersConfig,
    setProvidersConfig,
    setSelectedProviderId,
    setHighlightedField,
  ])
}

export function ProvidersConfig() {
  const selectedProviderId = useAtomValue(selectedProviderIdAtom)
  useRequestedProvider()
  const editor = isBuiltInAiProviderId(selectedProviderId) ? (
    <BuiltInProviderPanel key={selectedProviderId} providerId={selectedProviderId} />
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
      void setSelectedProviderId(selectedProviderId)
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
              className="h-auto rounded-xl border-dashed border-accent-blue bg-accent-blue/8 p-3 hover:bg-accent-blue/14 dark:border-accent-blue dark:bg-accent-blue/12 dark:hover:bg-accent-blue/20"
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
  const patchProviderConfig = useSetAtom(patchProviderConfigAtom)
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

    void patchProviderConfig({ id, changes: { enabled: checked } })
  }

  return (
    <EntityListItem.Root
      data-provider-id={id}
      selected={selectedProviderId === id}
      onClick={() => setSelectedProviderId(id)}
    >
      <EntityListItem.Badges>
        <>
          {sponsor?.sponsoring && (
            <SponsorBadge
              labelI18nKey={sponsor.badgeI18nKey}
              className="absolute -top-2 left-2 text-[10px]"
            />
          )}
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
  return (
    <section className="flex flex-col gap-2 pt-1">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">
        {i18n.t("options.apiProviders.builtInProvider" as never)}
      </h3>
      <div className="flex flex-col gap-4 pt-2">
        {BUILT_IN_AI_PROVIDER_IDS.map((providerId) => (
          <BuiltInProviderCard key={providerId} providerId={providerId} />
        ))}
      </div>
    </section>
  )
}

function BuiltInProviderCard({ providerId }: { providerId: BuiltInAiProviderId }) {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const config = useAtomValue(configAtom)
  const providerName = getBuiltInAiProviderName(providerId)
  const assignedFeatures = FEATURE_KEYS.filter(
    (key) => FEATURE_PROVIDER_DEFS[key].getProviderId(config) === providerId,
  )
  const assignedCustomActions = getSelectionToolbarActions(config.selectionToolbar).filter(
    (action) => action.providerId === providerId,
  )
  const isLanguageDetectionProvider =
    config.languageDetection.mode === "llm" && config.languageDetection.providerId === providerId
  const totalAssigned =
    assignedFeatures.length + assignedCustomActions.length + (isLanguageDetectionProvider ? 1 : 0)

  return (
    <EntityListItem.Root
      data-provider-id={providerId}
      selected={selectedProviderId === providerId}
      onClick={() => setSelectedProviderId(providerId)}
    >
      <EntityListItem.Badges>
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
  )
}

/**
 * Every hosted-capable FEATURE_KEYS entry, in FEATURE_KEYS order. Language
 * detection is a separate ProviderCapability rather than a FeatureKey, so the
 * built-in editor renders it with LanguageDetectionAssignment below.
 */
const BUILT_IN_FEATURE_KEYS = [
  "pageTranslation",
  "videoSubtitles",
  "selectionTranslation",
  "inputTranslation",
  "noteSuggestion",
] as const

function BuiltInProviderPanel({ providerId }: { providerId: BuiltInAiProviderId }) {
  const isAdvance = providerId === BUILT_IN_AI_ADVANCE_PROVIDER_ID
  const modelTier = isAdvance ? ("advance" as const) : ("normal" as const)
  const { status } = useHostedAiStatus()

  // Both cards list every hosted-capable feature. Same policy as the provider
  // dropdowns, and now literally the same predicate: the Ultra badge is the
  // viewer-independent `requiresUltra` product fact; rows lock only on durable
  // account facts (sign-in, plan), never on transient service state (exhausted
  // quota, open circuit, unconfigured model) — those surface at run time. Fail
  // open while status is unknown so one failed fetch never locks the UI.
  const getAssignmentStatus = (feature: HostedAiFeature) => {
    const tierStatus = getHostedAiTierStatus(status, feature, modelTier)
    return {
      disabled: isDurablyUnusableTier(tierStatus),
      requiresUltra: tierStatus?.requiresUltra === true,
    }
  }

  return (
    <BuiltInProviderEditor.Provider providerId={providerId}>
      <EntityEditor.Root>
        <EntityEditor.Body className="gap-6">
          <div className="flex flex-col gap-4">
            <ProviderEditor.Identity />
            <ProviderEditor.Attribution>
              {i18n.t(
                isAdvance
                  ? "options.apiProviders.providers.attribution.builtInAiAdvance"
                  : "options.apiProviders.providers.attribution.builtInAi",
              )}
            </ProviderEditor.Attribution>
          </div>
          <ProviderEditor.Assignments defaultOpen>
            {BUILT_IN_FEATURE_KEYS.map((featureKey) => (
              <ProviderEditor.FeatureAssignment
                key={featureKey}
                featureKey={featureKey}
                {...getAssignmentStatus(featureKey)}
              />
            ))}
            <ProviderEditor.LanguageDetectionAssignment
              {...getAssignmentStatus("languageDetection")}
            />
            <ProviderEditor.CustomActionAssignments {...getAssignmentStatus("customAction")} />
          </ProviderEditor.Assignments>
        </EntityEditor.Body>
      </EntityEditor.Root>
    </BuiltInProviderEditor.Provider>
  )
}
