import type { ComponentProps, ReactNode } from "react"
import type { ProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { FEATURE_KEYS, getFeatureLabelI18nKey } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { useCustomActionProviders, useFeatureProvider } from "./use-feature-providers"

type ProviderSelectorTriggerSize = ComponentProps<typeof ProviderSelector>["triggerSize"]

interface FeatureProviderSelectorListProps {
  className?: string
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  includeCustomActions?: boolean
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}

export { needsApiKeyWarning } from "./use-feature-providers"

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
  const { providers, providerId, providerConfig, setProviderId } = useFeatureProvider(featureKey)

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div className="flex flex-wrap" />}>
        {i18n.t(getFeatureLabelI18nKey(featureKey))}
        {renderApiKeyWarning?.(providerConfig)}
      </FieldLabel>
      <ProviderSelector
        providers={providers}
        value={providerId}
        onChange={setProviderId}
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
  const { actions, providers, getProviderConfig, setActionProviderId } = useCustomActionProviders()

  if (actions.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.general.featureProviders.customActions")}
      </p>
      {actions.map((action) => (
        <Field key={action.id}>
          <FieldLabel nativeLabel={false} render={<div />}>
            {action.name}
            {renderApiKeyWarning?.(getProviderConfig(action))}
          </FieldLabel>
          <ProviderSelector
            providers={providers}
            value={action.providerId}
            onChange={(id) => setActionProviderId(action.id, id)}
            className={providerSelectorClassName}
            triggerSize={providerSelectorTriggerSize}
            placeholder={i18n.t(
              "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.selectProvider",
            )}
          />
        </Field>
      ))}
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
      {FEATURE_KEYS.map((featureKey) => (
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
