import type { ComponentProps } from "react"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { FEATURE_KEYS, getFeatureLabelI18nKey } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { SetApiKeyWarning } from "./set-api-key-warning"
import { useCustomActionProviders, useFeatureProvider } from "./use-feature-providers"

type ProviderSelectorTriggerSize = ComponentProps<typeof ProviderSelector>["triggerSize"]

interface FeatureProviderSelectorListProps {
  className?: string
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  includeCustomActions?: boolean
}

function FeatureProviderField({
  featureKey,
  providerSelectorClassName,
  providerSelectorTriggerSize,
}: {
  featureKey: FeatureKey
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
}) {
  const { providers, providerId, providerConfig, setProviderId } = useFeatureProvider(featureKey)

  return (
    <Field>
      <FieldLabel
        nativeLabel={false}
        render={<div className="flex flex-wrap items-center gap-2" />}
      >
        {i18n.t(getFeatureLabelI18nKey(featureKey))}
        <SetApiKeyWarning providerConfig={providerConfig} />
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
}: {
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
}) {
  const { actions, providers, getProviderConfig, setActionProviderId } = useCustomActionProviders()

  if (actions.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.title")}
      </p>
      {actions.map((action) => (
        <Field key={action.id}>
          <FieldLabel
            nativeLabel={false}
            render={<div className="flex flex-wrap items-center gap-2" />}
          >
            {action.name}
            <SetApiKeyWarning providerConfig={getProviderConfig(action)} />
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
}: FeatureProviderSelectorListProps) {
  return (
    <FieldGroup className={cn("gap-4", className)}>
      {FEATURE_KEYS.map((featureKey) => (
        <FeatureProviderField
          key={featureKey}
          featureKey={featureKey}
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
        />
      ))}
      {includeCustomActions && (
        <CustomActionProviderFields
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
        />
      )}
    </FieldGroup>
  )
}
