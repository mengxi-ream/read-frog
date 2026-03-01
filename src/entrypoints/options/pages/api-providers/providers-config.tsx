import type { APIProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { Switch } from "@/components/ui/base-ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { isAPIProviderConfig } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { providerConfigAtom } from "@/utils/atoms/provider"
import { getAPIProvidersConfig } from "@/utils/config/helpers"
import { FEATURE_KEY_I18N_MAP, FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { API_PROVIDER_ITEMS } from "@/utils/constants/providers"
import { cn } from "@/utils/styles/utils"
import { ConfigCard } from "../../components/config-card"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { EntityListRail } from "../../components/entity-list-rail"
import AddProviderDialog from "./add-provider-dialog"
import { selectedProviderIdAtom } from "./atoms"
import { ProviderConfigForm } from "./provider-config-form"

export function ProvidersConfig() {
  const selectedProviderId = useAtomValue(selectedProviderIdAtom)

  return (
    <ConfigCard
      title={i18n.t("options.apiProviders.title")}
      description={i18n.t("options.apiProviders.description")}
      className="lg:flex-col"
    >
      <EntityEditorLayout list={<ProviderCardList />} editor={<ProviderConfigForm key={selectedProviderId} />} />
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
    const desiredOrderIds = newList.map(provider => provider.id)
    const desiredOrderIdSet = new Set(desiredOrderIds)

    const nonApiProviders = providersConfig.filter(provider => !isAPIProviderConfig(provider))
    const currentApiProviders = providersConfig.filter(isAPIProviderConfig)

    const apiProvidersById = new Map(currentApiProviders.map(provider => [provider.id, provider] as const))

    const reorderedApiProviders: APIProviderConfig[] = []
    for (const id of desiredOrderIds) {
      const provider = apiProvidersById.get(id)
      if (provider)
        reorderedApiProviders.push(provider)
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
    if (didLockInitialSelectionRef.current)
      return
    if (selectedProviderId) {
      setSelectedProviderId(selectedProviderId)
      didLockInitialSelectionRef.current = true
    }
  }, [selectedProviderId, setSelectedProviderId])

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger
          render={(
            <Button
              variant="outline"
              className="h-auto p-3 border-dashed rounded-xl"
              onClick={() => setIsAddDialogOpen(true)}
            />
          )}
        >
          <div className="flex items-center justify-center gap-2 w-full">
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
          renderItem={providerConfig => (
            <ProviderCard providerConfig={providerConfig} />
          )}
        />
      </EntityListRail>
    </div>
  )
}

function ProviderCard({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { id, name, provider, enabled } = providerConfig
  const { theme } = useTheme()
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const setProviderConfig = useSetAtom(providerConfigAtom(id))
  const config = useAtomValue(configAtom)

  const assignedFeatures = FEATURE_KEYS
    .filter(key => FEATURE_PROVIDER_DEFS[key].getProviderId(config) === id)
  const assignedCustomFeatures = config.selectionToolbar.customFeatures
    .filter(f => f.providerId === id)
  const totalAssigned = assignedFeatures.length + assignedCustomFeatures.length

  const handleProviderEnabledChange = (checked: boolean) => {
    if (!checked && enabled && totalAssigned > 0) {
      toast.error(i18n.t("options.apiProviders.form.providerInUseCannotDisable", [name, totalAssigned]))
      return
    }

    void setProviderConfig({ ...providerConfig, enabled: checked })
  }

  return (
    <div
      className={cn(
        "rounded-xl p-3 border bg-card relative",
        selectedProviderId === id && "border-primary",
      )}
      onClick={() => setSelectedProviderId(id)}
    >
      {totalAssigned > 0 && (
        <div className="absolute -top-2 right-2 flex items-center justify-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={(
                <Badge className="bg-blue-500 cursor-default" size="sm" />
              )}
            >
              {i18n.t("options.apiProviders.badges.featureCount", [totalAssigned])}
            </TooltipTrigger>
            <TooltipContent>
              <ul className="list-disc list-inside marker:text-green-500">
                {assignedFeatures.map(key => (
                  <li key={key}>{i18n.t(`options.general.featureProviders.features.${FEATURE_KEY_I18N_MAP[key]}`)}</li>
                ))}
                {assignedCustomFeatures.map(f => (
                  <li key={f.id}>{f.name}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <ProviderIcon logo={API_PROVIDER_ITEMS[provider].logo(theme)} name={name} size="base" textClassName="text-sm" />
        <Switch
          checked={enabled}
          onCheckedChange={handleProviderEnabledChange}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
