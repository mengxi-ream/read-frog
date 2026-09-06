import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { Switch } from "@/components/ui/base-ui/switch"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { FEATURE_PROVIDER_DEFS, getFeatureLabelI18nKey } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { isProviderIdDurablyUnusable } from "@/utils/providers/provider-availability"
import { canResolvedProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * Only the features whose prompts change with the smart-context flag. Note
 * suggestion always sends raw page context regardless of the flag, so it has
 * no status to report here.
 */
const CONTEXT_AWARE_FEATURE_KEYS = [
  "pageTranslation",
  "videoSubtitles",
  "selectionTranslation",
  "inputTranslation",
] as const satisfies readonly FeatureKey[]

/**
 * Context only reaches a feature whose provider can read it, so each feature reports on its own
 * line — a translation running on a non-LLM provider is the one thing a user has to go fix.
 */
function FeatureStatusList() {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const { status } = useHostedAiStatus()

  const statuses = useMemo(
    () =>
      CONTEXT_AWARE_FEATURE_KEYS.map((featureKey) => {
        const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
        // Capability-based: Built-in AI is synthesized by the registry and is
        // never a row in providersConfig, so a direct providersConfig lookup
        // would report it as unconfigured forever.
        const providerRef = resolveProviderRefForCapability(featureKey, providersConfig, providerId)
        const featureName = i18n.t(getFeatureLabelI18nKey(featureKey))
        // Context reaches the prompt only on prompt-driven providers: hosted
        // Built-in AI or a local LLM — never pure translate (Google, DeepL…).
        // A `kind === "system"` check alone answers "is it prompt-driven", not
        // "does it run", so it reported every feature configured for accounts
        // whose plan funds none of them — signed-out guests included.
        const hasLLMProvider = providerRef
          ? canResolvedProviderRefGenerateText(providerRef) &&
            !isProviderIdDurablyUnusable(providerId, featureKey, status)
          : false

        return {
          featureKey,
          hasLLMProvider,
          text: hasLLMProvider
            ? i18n.t("options.apiProviders.aiContentAware.llmProviderConfigured", [featureName])
            : i18n.t("options.apiProviders.aiContentAware.llmProviderNotConfigured", [featureName]),
        }
      }),
    [config, providersConfig, status],
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
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)

  return (
    <ConfigSection
      id="ai-content-aware"
      title={i18n.t("options.apiProviders.aiContentAware.title")}
    >
      <ConfigItem
        title={i18n.t("options.apiProviders.aiContentAware.enable")}
        description={
          <>
            {i18n.t("options.apiProviders.aiContentAware.enableDescription")}
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
