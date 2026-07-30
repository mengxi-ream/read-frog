import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { Switch } from "@/components/ui/base-ui/switch"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import {
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * Context only reaches a feature whose provider can read it, so each feature reports on its own
 * line — a translation running on a non-LLM provider is the one thing a user has to go fix.
 */
function FeatureStatusList() {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const statuses = useMemo(
    () =>
      FEATURE_KEYS.map((featureKey) => {
        const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
        const providerConfig = getProviderConfigById(providersConfig, providerId)
        const featureName = i18n.t(getFeatureLabelI18nKey(featureKey))
        const hasLLMProvider = providerConfig ? isLLMProviderConfig(providerConfig) : false

        return {
          featureKey,
          hasLLMProvider,
          text: hasLLMProvider
            ? i18n.t("options.translation.llmProviderConfigured", [featureName])
            : i18n.t("options.translation.llmProviderNotConfigured", [featureName]),
        }
      }),
    [config, providersConfig],
  )

  return (
    <span className="mt-2 flex flex-col gap-1">
      {statuses.map(({ featureKey, hasLLMProvider, text }) => (
        <span key={featureKey} className="flex items-center gap-1.5">
          <span
            className={`size-2 shrink-0 rounded-full ${hasLLMProvider ? "bg-green-500" : "bg-orange-400"}`}
          />
          <span className="text-xs">{text}</span>
        </span>
      ))}
    </span>
  )
}

export function AIContentAwareConfig() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <ConfigSection id="ai-content-aware" title={i18n.t("options.translation.aiContentAware.title")}>
      <ConfigItem
        title={i18n.t("options.translation.aiContentAware.enable")}
        description={
          <>
            {i18n.t("options.translation.aiContentAware.enableDescription")}
            <FeatureStatusList />
          </>
        }
      >
        <Switch
          checked={translateConfig.enableAIContentAware}
          onCheckedChange={(checked) => {
            void setTranslateConfig({ enableAIContentAware: checked })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}
