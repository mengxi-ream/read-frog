import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { GLOSSARY_FEATURE_KEYS } from "@/utils/glossary/features"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { LlmFeatureStatusList } from "../../../components/llm-feature-status-list"

/**
 * The glossary travels in the prompt, so it reaches only features running on a
 * provider that takes one — which is why the status list sits under this
 * switch rather than in a warning that appears once something is already wrong.
 */
export function GlossaryEnableItem() {
  const [glossary, setGlossary] = useAtom(configFieldsAtomMap.glossary)

  return (
    <ConfigItem
      id="glossary-enabled"
      title={i18n.t("options.advanced.glossary.enable.title")}
      description={
        <>
          {i18n.t("options.advanced.glossary.enable.description")}
          <LlmFeatureStatusList featureKeys={GLOSSARY_FEATURE_KEYS} />
        </>
      }
    >
      <Switch
        checked={glossary.enabled}
        onCheckedChange={(checked) => {
          void setGlossary({ ...glossary, enabled: checked })
        }}
      />
    </ConfigItem>
  )
}
