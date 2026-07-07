import type { ComponentProps, ReactNode } from "react"
import type { ProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { isAPIProviderConfig, isPureAPIProvider } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { buildFeatureProviderPatch, FEATURE_KEYS, FEATURE_PROVIDER_DEFS, getFeatureLabelI18nKey } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { cn } from "@/utils/styles/utils"

type ProviderSelectorTriggerSize = ComponentProps<typeof ProviderSelector>["triggerSize"]

interface FeatureProviderSelectorListProps {
  className?: string
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  includeCustomActions?: boolean
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}

export function needsApiKeyWarning(providerConfig: ProviderConfig | null): boolean {
  return !!providerConfig
    && isAPIProviderConfig(providerConfig)
    && !isPureAPIProvider(providerConfig.provider)
    && !providerConfig.apiKey
}

function FeatureProviderField({
  featureKey,
  providerSelectorClassName,
  providerSelectorTriggerSize,
  renderApiKeyWarning,
}: {
  featureKey: FeatureKey
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const def = FEATURE_PROVIDER_DEFS[featureKey]
  const providerId = def.getProviderId(config)
  const providerConfig = getProviderConfigById(providersConfig, providerId) ?? null

  const providers = useMemo(() =>
    getSelectableProvidersForCapability(featureKey, providersConfig),
  [providersConfig, featureKey])

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div className="flex flex-wrap" />}>
        {i18n.t(getFeatureLabelI18nKey(featureKey))}
        {renderApiKeyWarning?.(providerConfig)}
      </FieldLabel>
      <ProviderSelector
        providers={providers}
        value={providerId}
        onChange={id => void setConfig(buildFeatureProviderPatch({ [featureKey]: id }))}
        className={providerSelectorClassName}
        triggerSize={providerSelectorTriggerSize}
      />
    </Field>
  )
}

function CustomActionProviderFields({
  providerSelectorClassName,
  providerSelectorTriggerSize,
  renderApiKeyWarning,
}: {
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const customActionProviders = useMemo(
    () => getSelectableProvidersForCapability("selectionToolbar.customAction", providersConfig),
    [providersConfig],
  )

  const customActions = config.selectionToolbar.customActions

  if (customActions.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.general.featureProviders.customActions")}
      </p>
      {customActions.map((action) => {
        const currentProviderConfig = getProviderConfigById(providersConfig, action.providerId) ?? null
        return (
          <Field key={action.id}>
            <FieldLabel nativeLabel={false} render={<div />}>
              {action.name}
              {renderApiKeyWarning?.(currentProviderConfig)}
            </FieldLabel>
            <ProviderSelector
              providers={customActionProviders}
              value={action.providerId}
              onChange={(id) => {
                const updatedCustomActions = config.selectionToolbar.customActions.map(item =>
                  item.id === action.id
                    ? { ...item, providerId: id }
                    : item,
                )

                void setConfig({
                  selectionToolbar: {
                    ...config.selectionToolbar,
                    customActions: updatedCustomActions,
                  },
                })
              }}
              className={providerSelectorClassName}
              triggerSize={providerSelectorTriggerSize}
              placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.selectProvider")}
            />
          </Field>
        )
      })}
    </>
  )
}

export function FeatureProviderSelectorList({
  className,
  providerSelectorClassName = "w-full",
  providerSelectorTriggerSize,
  includeCustomActions = true,
  renderApiKeyWarning,
}: FeatureProviderSelectorListProps) {
  return (
    <FieldGroup className={cn("gap-4", className)}>
      {FEATURE_KEYS.map(featureKey => (
        <FeatureProviderField
          key={featureKey}
          featureKey={featureKey}
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
          renderApiKeyWarning={renderApiKeyWarning}
        />
      ))}
      {includeCustomActions && (
        <CustomActionProviderFields
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
          renderApiKeyWarning={renderApiKeyWarning}
        />
      )}
    </FieldGroup>
  )
}
