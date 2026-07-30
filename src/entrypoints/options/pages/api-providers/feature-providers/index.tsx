import type { ReactNode } from "react"
import type { ProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { SetApiKeyWarning } from "@/components/llm-providers/set-api-key-warning"
import {
  useCustomActionProviders,
  useFeatureProvider,
} from "@/components/llm-providers/use-feature-providers"
import {
  FEATURE_KEYS,
  getFeatureDescriptionI18nKey,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** How much of a custom action's system prompt stands in for a description before it is cut. */
const SYSTEM_PROMPT_PREVIEW_LENGTH = 80

/**
 * Custom actions carry no description of their own, so the head of their system prompt stands
 * in for one. Newlines and markdown headings are collapsed to keep it to a single line.
 */
export function toSystemPromptPreview(action: SelectionToolbarCustomAction): string {
  const singleLine = (action.systemPrompt.trim() || action.prompt).replace(/\s+/g, " ").trim()
  if (singleLine.length <= SYSTEM_PROMPT_PREVIEW_LENGTH) {
    return singleLine
  }
  return `${singleLine.slice(0, SYSTEM_PROMPT_PREVIEW_LENGTH).trimEnd()}…`
}

function FeatureProviderTitle({
  children,
  providerConfig,
}: {
  children: ReactNode
  providerConfig: ProviderConfig | null
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      <SetApiKeyWarning providerConfig={providerConfig} />
    </span>
  )
}

function FeatureProviderItem({ featureKey }: { featureKey: FeatureKey }) {
  const { providers, providerId, providerConfig, setProviderId } = useFeatureProvider(featureKey)

  return (
    <ConfigItem
      title={
        <FeatureProviderTitle providerConfig={providerConfig}>
          {i18n.t(getFeatureLabelI18nKey(featureKey))}
        </FeatureProviderTitle>
      }
      description={i18n.t(getFeatureDescriptionI18nKey(featureKey))}
    >
      <ProviderSelector
        providers={providers}
        value={providerId}
        onChange={setProviderId}
        triggerSize="sm"
        selectContentProps={SELECT_CONTENT_PROPS}
      />
    </ConfigItem>
  )
}

function CustomActionProviderItems() {
  const { actions, providers, getProviderConfig, setActionProviderId } = useCustomActionProviders()

  return actions.map((action) => (
    <ConfigItem
      key={action.id}
      title={
        <FeatureProviderTitle providerConfig={getProviderConfig(action)}>
          {action.name}
        </FeatureProviderTitle>
      }
      description={toSystemPromptPreview(action)}
    >
      <ProviderSelector
        providers={providers}
        value={action.providerId}
        onChange={(id) => setActionProviderId(action.id, id)}
        triggerSize="sm"
        selectContentProps={SELECT_CONTENT_PROPS}
        placeholder={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.selectProvider",
        )}
      />
    </ConfigItem>
  ))
}

export function FeatureProvidersConfig() {
  return (
    <ConfigSection id="feature-providers" title={i18n.t("options.general.featureProviders.title")}>
      {FEATURE_KEYS.map((featureKey) => (
        <FeatureProviderItem key={featureKey} featureKey={featureKey} />
      ))}
      <CustomActionProviderItems />
    </ConfigSection>
  )
}
