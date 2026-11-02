import { useAtom } from "jotai"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { useFeatureProvider } from "@/components/llm-providers/use-feature-providers"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { ShortcutLink } from "../../../components/shortcut-link"

/**
 * The toolbar's word-annotation slot: its switch, and the provider its
 * meanings come from. A meaning is the selection's translation, so that
 * provider is the translate feature's, and this row edits that one setting.
 */
export function AnnotationSection() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { annotation } = selectionToolbar
  const translateProvider = useFeatureProvider("selectionTranslation")

  return (
    <ConfigSection
      id="selection-toolbar-annotation"
      title={i18n.t("options.selectionToolbar.annotation.title")}
    >
      <ConfigItem
        id="selection-toolbar-annotation-enable"
        title={i18n.t("options.selectionToolbar.annotation.enable.title")}
        description={
          <>
            {i18n.t("options.selectionToolbar.annotation.enable.description")}
            <ShortcutLink sectionId="selection-annotation-shortcut" />
          </>
        }
      >
        <Switch
          checked={annotation.enabled}
          onCheckedChange={(checked) => {
            void setSelectionToolbar({
              ...selectionToolbar,
              annotation: { ...annotation, enabled: checked },
            })
          }}
        />
      </ConfigItem>
      <ConfigItem
        id="selection-toolbar-annotation-provider"
        title={i18n.t("options.selectionToolbar.annotation.provider.title")}
        description={i18n.t("options.selectionToolbar.annotation.provider.description")}
      >
        <ProviderSelector
          providers={translateProvider.providers}
          value={translateProvider.providerId}
          onChange={translateProvider.setProviderId}
          triggerSize="sm"
        />
      </ConfigItem>
    </ConfigSection>
  )
}
