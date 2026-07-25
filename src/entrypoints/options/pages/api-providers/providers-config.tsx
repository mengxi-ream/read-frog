import type { APIProviderConfig } from "@/types/config/provider"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { SponsorBadge } from "@/components/badges/sponsor-badge"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/base-ui/collapsible"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { Switch } from "@/components/ui/base-ui/switch"
import { anchoredToastManager } from "@/components/ui/base-ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { isAPIProviderConfig } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { providerConfigAtom } from "@/utils/atoms/provider"
import { getAPIProvidersConfig } from "@/utils/config/helpers"
import {
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { API_PROVIDER_ITEMS } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_PROVIDER_LOGO,
} from "@/utils/providers/provider-registry"
import { cn } from "@/utils/styles/utils"
import { ConfigCard } from "../../components/config-card"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { EntityListRail } from "../../components/entity-list-rail"
import AddProviderDialog from "./add-provider-dialog"
import { selectedProviderIdAtom } from "./atoms"
import { ProviderConfigForm } from "./provider-config-form"

export function ProvidersConfig() {
  const selectedProviderId = useAtomValue(selectedProviderIdAtom)
  const editor =
    selectedProviderId === BUILT_IN_AI_PROVIDER_ID ? (
      <BuiltInProviderPanel />
    ) : (
      <ProviderConfigForm key={selectedProviderId} />
    )

  return (
    <ConfigCard
      id="api-providers"
      title={i18n.t("options.apiProviders.title")}
      description={i18n.t("options.apiProviders.description")}
      className="lg:flex-col"
    >
      <EntityEditorLayout list={<ProviderCardList />} editor={editor} />
    </ConfigCard>
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
  const assignedCustomActions = config.selectionToolbar.customActions.filter(
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
    <ProviderListCell
      providerId={id}
      logo={API_PROVIDER_ITEMS[provider].logo(theme)}
      name={name}
      checked={enabled}
      selected={selectedProviderId === id}
      onSelect={() => setSelectedProviderId(id)}
      onCheckedChange={handleProviderEnabledChange}
      switchRef={switchRef}
      badges={
        <>
          {sponsor?.sponsoring && <SponsorBadge className="absolute -top-2 left-2 text-[10px]" />}
          <FeatureCountBadge count={totalAssigned}>
            {assignedFeatures.map((key) => (
              <li key={key}>{i18n.t(getFeatureLabelI18nKey(key))}</li>
            ))}
            {isLanguageDetectionProvider && (
              <li>{i18n.t("options.general.languageDetection.title")}</li>
            )}
            {assignedCustomActions.map((action) => (
              <li key={action.id}>{action.name}</li>
            ))}
          </FeatureCountBadge>
        </>
      }
    />
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

interface ProviderListCellProps {
  providerId: string
  logo: string
  name: string
  checked: boolean
  selected: boolean
  disabled?: boolean
  badges?: React.ReactNode
  onSelect: () => void
  onCheckedChange?: (checked: boolean) => void
  switchRef?: React.Ref<HTMLButtonElement>
}

function ProviderListCell({
  providerId,
  logo,
  name,
  checked,
  selected,
  disabled,
  badges,
  onSelect,
  onCheckedChange,
  switchRef,
}: ProviderListCellProps) {
  return (
    <div
      data-provider-id={providerId}
      className={cn(
        "relative cursor-pointer rounded-xl border bg-card p-3",
        selected && "border-primary",
      )}
      onClick={onSelect}
    >
      {badges}
      <div className="flex items-center justify-between gap-2">
        <ProviderIcon logo={logo} name={name} size="base" textClassName="text-sm" />
        <Switch
          ref={switchRef}
          aria-label={name}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

function BuiltInProviderSection() {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const config = useAtomValue(configAtom)
  const providerName = i18n.t("options.apiProviders.providers.name.builtInAi")
  const assignedCustomActions = config.selectionToolbar.customActions.filter(
    (action) => action.providerId === BUILT_IN_AI_PROVIDER_ID,
  )

  return (
    <section className="flex flex-col gap-2 pt-1">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">
        {i18n.t("options.apiProviders.builtInProvider" as never)}
      </h3>
      <ProviderListCell
        providerId={BUILT_IN_AI_PROVIDER_ID}
        logo={BUILT_IN_AI_PROVIDER_LOGO}
        name={providerName}
        checked
        disabled
        selected={selectedProviderId === BUILT_IN_AI_PROVIDER_ID}
        onSelect={() => setSelectedProviderId(BUILT_IN_AI_PROVIDER_ID)}
        badges={
          <FeatureCountBadge count={assignedCustomActions.length}>
            {assignedCustomActions.map((action) => (
              <li key={action.id}>{action.name}</li>
            ))}
          </FeatureCountBadge>
        }
      />
    </section>
  )
}

function BuiltInProviderPanel() {
  const providerName = i18n.t("options.apiProviders.providers.name.builtInAi")
  const atlasCloudProvider = API_PROVIDER_ITEMS.atlascloud
  const atlasCloudUrl = atlasCloudProvider.sponsor?.referUrl ?? atlasCloudProvider.website

  return (
    <div className="flex-1 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <ProviderIcon
            logo={BUILT_IN_AI_PROVIDER_LOGO}
            name={providerName}
            size="base"
            textClassName="font-medium"
          />
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              {i18n.t("options.apiProviders.providers.attribution.builtInAi" as never)}
            </p>
            <Button
              variant="brand"
              render={<a href={atlasCloudUrl} target="_blank" rel="noreferrer" />}
            >
              {i18n.t("options.apiProviders.sponsorCta")}
            </Button>
          </div>
        </div>
        <BuiltInFeatureProviderSection />
      </div>
    </div>
  )
}

function BuiltInFeatureProviderSection() {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const [isOpen, setIsOpen] = useState(true)
  const customActions = config.selectionToolbar.customActions

  if (customActions.length === 0) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
        <Icon
          icon="tabler:chevron-right"
          className={cn("size-4 transition-transform duration-200", isOpen && "rotate-90")}
        />
        <span>{i18n.t("options.apiProviders.form.featureProviders")}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3">
          {customActions.map((action) => {
            const isAssigned = action.providerId === BUILT_IN_AI_PROVIDER_ID
            return (
              <div key={action.id} className="flex items-center gap-2">
                <Switch
                  checked={isAssigned}
                  disabled={isAssigned}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      return
                    }

                    const updatedCustomActions = config.selectionToolbar.customActions.map(
                      (currentAction) =>
                        currentAction.id === action.id
                          ? { ...currentAction, providerId: BUILT_IN_AI_PROVIDER_ID }
                          : currentAction,
                    )

                    void setConfig({
                      selectionToolbar: {
                        ...config.selectionToolbar,
                        customActions: updatedCustomActions,
                      },
                    })
                  }}
                />
                <span className="text-sm">{action.name}</span>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
