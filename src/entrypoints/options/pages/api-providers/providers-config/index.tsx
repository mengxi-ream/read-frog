import type { Config } from "@/types/config/config"
import type { APIProviderConfig } from "@/types/config/provider"
import type { HostedAiModel } from "@/utils/hosted-ai/models"
import type { HostedAiFeature, HostedAiStatus } from "@/utils/hosted-ai/types"
import type {
  BuiltInAiUnavailability,
  SystemProviderSelectorItem,
} from "@/utils/providers/provider-display"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { SponsorBadge } from "@/components/badges/sponsor-badge"
import { ModelIcon } from "@/components/llm-providers/model-icon"
import { ModelUnavailableIcon } from "@/components/llm-providers/model-unavailable-icon"
import { useBuiltInAiModels } from "@/components/llm-providers/use-built-in-ai-models"
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
import { type BuiltInAiProviderId, getBuiltInAiModelId } from "@/utils/constants/provider-ids"
import { API_PROVIDER_ITEMS } from "@/utils/constants/providers"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { getHostedAiModelUnavailableReason } from "@/utils/hosted-ai/model-errors"
import { findHostedAiModel } from "@/utils/hosted-ai/models"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import { i18n } from "@/utils/i18n"
import {
  getRequestedProviderId,
  getRequestedProviderType,
  PROVIDER_CONFIG_SECTION_ID,
  shouldHighlightApiKey,
} from "@/utils/navigation"
import { isPlanWalledTier } from "@/utils/providers/provider-availability"
import { getBuiltInAiUnavailability } from "@/utils/providers/provider-display"
import {
  getBuiltInAiProviderName,
  getBuiltInAiSelectorItems,
  isBuiltInAiProviderId,
} from "@/utils/providers/provider-registry"
import { ConfigItem } from "../../../components/config-item"
import { EntityEditor } from "../../../components/entity-editor"
import { EntityEditorLayout } from "../../../components/entity-editor-layout"
import { EntityListItem } from "../../../components/entity-list-item"
import { EntityListRail } from "../../../components/entity-list-rail"
import AddProviderDialog from "./add-provider-dialog"
import { highlightedProviderFieldAtom, selectedProviderIdAtom } from "./atoms"
import { BuiltInModelReasoningField, BuiltInModelUnavailableAlert } from "./built-in-model-fields"
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

/**
 * Every Built-in AI provider id the config points at, so a model the server
 * stopped listing still gets a card (marked unavailable) while something uses it.
 */
function getAssignedBuiltInAiProviderIds(config: Config): string[] {
  return [
    ...FEATURE_KEYS.map((key) => FEATURE_PROVIDER_DEFS[key].getProviderId(config)),
    ...getSelectionToolbarActions(config.selectionToolbar).map((action) => action.providerId),
    ...(config.languageDetection.mode === "llm" && config.languageDetection.providerId
      ? [config.languageDetection.providerId]
      : []),
  ].filter(isBuiltInAiProviderId)
}

/**
 * The models to suggest instead of one that cannot run, in the server's order:
 * listed, able to run, and open to this account for at least one feature. A
 * model that needs a plan the account lacks is no way to keep going.
 */
function getAlternativeModelNames(
  models: readonly HostedAiModel[] | null,
  status: HostedAiStatus | undefined,
  exceptModelId: string,
): string[] {
  return (models ?? [])
    .filter(
      (model) =>
        model.id !== exceptModelId &&
        model.available &&
        BUILT_IN_HOSTED_FEATURES.some(
          (feature) => !isPlanWalledTier(getHostedAiTierStatus(status, feature, model.tier)),
        ),
    )
    .map((model) => model.name)
}

function ProviderCardList() {
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const config = useAtomValue(configAtom)
  const { status } = useHostedAiStatus()
  const { models } = useBuiltInAiModels()
  const builtInAiItems = getBuiltInAiSelectorItems(models, getAssignedBuiltInAiProviderIds(config))
  const getUnavailableReason = (item: SystemProviderSelectorItem) => {
    const unavailability = getBuiltInAiUnavailability(item)
    return unavailability
      ? getHostedAiModelUnavailableReason(
          item.name,
          unavailability,
          getAlternativeModelNames(models, status, item.model),
        )
      : undefined
  }
  const apiProvidersConfig = getAPIProvidersConfig(providersConfig)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

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

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="h-auto rounded-xl border-dashed border-accent bg-accent/8 p-3 hover:bg-accent/14 dark:border-accent dark:bg-accent/12 dark:hover:bg-accent/20"
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
      <ProviderListSection title={i18n.t("options.apiProviders.builtInProvider")}>
        <div className="flex flex-col gap-4 pt-2">
          {builtInAiItems.map((item) => (
            <BuiltInProviderCard
              key={item.id}
              item={item}
              unavailableReason={getUnavailableReason(item)}
            />
          ))}
        </div>
      </ProviderListSection>
      {apiProvidersConfig.length > 0 && (
        <ProviderListSection title={i18n.t("options.apiProviders.thirdPartyProviders")}>
          <EntityListRail>
            <SortableList
              list={apiProvidersConfig}
              setList={handleReorder}
              className="flex flex-col gap-4 pt-2"
              renderItem={(providerConfig) => <ProviderCard providerConfig={providerConfig} />}
            />
          </EntityListRail>
        </ProviderListSection>
      )}
    </div>
  )
}

function ProviderListSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 pt-1">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function ProviderCard({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { id, name, provider, enabled } = providerConfig
  const { theme } = useTheme()
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const patchProviderConfig = useSetAtom(patchProviderConfigAtom)
  const assignments = useProviderAssignments(id)
  const sponsor = API_PROVIDER_ITEMS[provider].sponsor
  const switchRef = useRef<HTMLButtonElement>(null)

  const handleProviderEnabledChange = (checked: boolean) => {
    if (!checked && enabled && assignments.length > 0) {
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
          assignments.length,
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
          <FeatureCountBadge assignments={assignments} />
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

interface ProviderAssignment {
  key: string
  label: string
}

/**
 * What the config runs on a provider, labelled for display: its features, then
 * language detection, then its selection-toolbar actions.
 */
function useProviderAssignments(providerId: string): ProviderAssignment[] {
  const config = useAtomValue(configAtom)
  const { languageDetection } = config

  return [
    ...FEATURE_KEYS.filter(
      (key) => FEATURE_PROVIDER_DEFS[key].getProviderId(config) === providerId,
    ).map((key) => ({ key: `feature:${key}`, label: i18n.t(getFeatureLabelI18nKey(key)) })),
    ...(languageDetection.mode === "llm" && languageDetection.providerId === providerId
      ? [
          {
            key: "languageDetection",
            label: i18n.t("options.apiProviders.languageDetection.title"),
          },
        ]
      : []),
    ...getSelectionToolbarActions(config.selectionToolbar)
      .filter((action) => action.providerId === providerId)
      .map((action) => ({ key: `action:${action.id}`, label: action.name })),
  ]
}

function FeatureCountBadge({ assignments }: { assignments: ProviderAssignment[] }) {
  if (assignments.length === 0) {
    return null
  }

  return (
    <div className="absolute -top-2 right-2 flex items-center justify-center gap-1">
      <Tooltip>
        <TooltipTrigger render={<Badge variant="accent" className="cursor-default" size="sm" />}>
          {i18n.t("options.apiProviders.badges.featureCount", [assignments.length])}
        </TooltipTrigger>
        <TooltipContent>
          <ul className="list-inside list-disc marker:text-green-500">
            {assignments.map(({ key, label }) => (
              <li key={key}>{label}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function BuiltInProviderCard({
  item,
  unavailableReason,
}: {
  item: SystemProviderSelectorItem
  /** Why the model cannot run and what to pick instead; undefined when it can. */
  unavailableReason: string | undefined
}) {
  const providerId = item.id
  const { theme } = useTheme()
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const assignments = useProviderAssignments(providerId)

  return (
    <EntityListItem.Root
      data-provider-id={providerId}
      selected={selectedProviderId === providerId}
      onClick={() => setSelectedProviderId(providerId)}
    >
      <EntityListItem.Badges>
        <>
          {/* On the border like the count badge; the card's own background hides the line behind it. */}
          {unavailableReason && (
            <ModelUnavailableIcon
              reason={unavailableReason}
              className="absolute -top-2 left-2 rounded-sm bg-card px-0.5"
            />
          )}
          <FeatureCountBadge assignments={assignments} />
        </>
      </EntityListItem.Badges>
      <EntityListItem.Content>
        <ModelIcon
          vendor={item.vendor}
          name={item.name}
          theme={theme}
          size="base"
          textClassName="text-sm"
        />
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

/** Every feature the built-in editor can assign a model to. */
const BUILT_IN_HOSTED_FEATURES = [
  ...BUILT_IN_FEATURE_KEYS,
  "languageDetection",
  "customAction",
] as const satisfies readonly HostedAiFeature[]

function BuiltInProviderPanel({ providerId }: { providerId: BuiltInAiProviderId }) {
  const { status } = useHostedAiStatus()
  const { models } = useBuiltInAiModels()
  const modelId = getBuiltInAiModelId(providerId)
  const model = modelId === null ? undefined : findHostedAiModel(models, modelId)
  const modelTier = model?.tier
  const isAdvance = modelTier === "advance"
  // Only a known list can say a model is gone; without one, the server decides when asked.
  const unavailability: BuiltInAiUnavailability | null =
    models === null || modelId === null
      ? null
      : model === undefined
        ? "removed"
        : model.available
          ? null
          : "temporary"

  // Both cards list every hosted-capable feature. Same policy as the provider
  // dropdowns, and now literally the same predicate: the plan badge is the
  // plan this account lacks (`upgradeTo`); rows lock only behind that plan,
  // never on what signing in or waiting fixes (a guest, exhausted quota, open
  // circuit, unconfigured model) — those surface at run time. Fail
  // open while status is unknown so one failed fetch never locks the UI.
  const getAssignmentStatus = (feature: HostedAiFeature) => {
    const tierStatus =
      modelTier === undefined ? undefined : getHostedAiTierStatus(status, feature, modelTier)
    return {
      disabled: isPlanWalledTier(tierStatus),
      upgradeTo: tierStatus?.upgradeTo ?? undefined,
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
            {unavailability && modelId !== null && (
              <BuiltInModelUnavailableAlert
                name={getBuiltInAiProviderName(providerId, models)}
                unavailability={unavailability}
                alternativeNames={getAlternativeModelNames(models, status, modelId)}
              />
            )}
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
          {model && <BuiltInModelReasoningField model={model} />}
        </EntityEditor.Body>
      </EntityEditor.Root>
    </BuiltInProviderEditor.Provider>
  )
}
