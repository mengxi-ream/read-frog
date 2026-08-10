import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { ShortcutLink } from "../../../components/shortcut-link"

/**
 * Translating one paragraph at a time. The section owns whether the feature runs at all — the
 * key it listens for is set on the Shortcuts page, which the row links to.
 */
export function HoverTranslationSection() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)

  return (
    <ConfigSection
      id="hover-translation"
      title={i18n.t("options.translation.hoverTranslation.title")}
    >
      <ConfigItem
        title={i18n.t("options.translation.hoverTranslation.enable.title")}
        description={
          <>
            {i18n.t("options.translation.hoverTranslation.enable.description")}
            <ShortcutLink sectionId="node-translation-hotkey" />
          </>
        }
      >
        <Switch
          checked={translateConfig.node.enabled}
          onCheckedChange={(checked) => {
            void setTranslateConfig({ node: { ...translateConfig.node, enabled: checked } })
          }}
        />
      </ConfigItem>
      <ConfigItem
        title={i18n.t("options.translation.hoverTranslation.forceRetranslation.title")}
        description={i18n.t("options.translation.hoverTranslation.forceRetranslation.description")}
      >
        <Switch
          checked={translateConfig.node.forceRetranslation}
          onCheckedChange={(checked) => {
            void setTranslateConfig({
              node: { ...translateConfig.node, forceRetranslation: checked },
            })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}
