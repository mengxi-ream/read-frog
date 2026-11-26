import { GLOSSARY_FEATURE_KEYS } from "@/utils/glossary/features"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { LlmFeatureStatusList } from "../../../components/llm-feature-status-list"

/**
 * The glossary travels in the prompt, so it reaches only features running on a provider that
 * takes one. The status list says which ones do, here, rather than in a warning that appears once
 * something is already wrong. The glossary itself is turned on and off in simple mode.
 */
export function GlossaryAppliesToItem() {
  return (
    <ConfigItem
      id="glossary-applies-to"
      title={i18n.t("options.advanced.glossary.appliesTo.title")}
      description={
        <>
          {i18n.t("options.advanced.glossary.appliesTo.description")}
          <LlmFeatureStatusList featureKeys={GLOSSARY_FEATURE_KEYS} />
        </>
      }
    />
  )
}
