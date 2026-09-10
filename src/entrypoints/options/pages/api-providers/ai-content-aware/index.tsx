import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { LlmFeatureStatusList } from "../../../components/llm-feature-status-list"

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
            <LlmFeatureStatusList featureKeys={CONTEXT_AWARE_FEATURE_KEYS} />
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
