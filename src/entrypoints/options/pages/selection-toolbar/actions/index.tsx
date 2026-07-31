import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { SaveSuggestionItems } from "./save-suggestion-items"

/** What the toolbar can do with a selection: the two built-in buttons, and the save prompt. */
export function ActionsSection() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { features } = selectionToolbar

  const setFeatureEnabled = (key: "translate" | "speak", enabled: boolean) => {
    void setSelectionToolbar({
      ...selectionToolbar,
      features: {
        ...features,
        [key]: { ...features[key], enabled },
      },
    })
  }

  return (
    <ConfigSection
      id="selection-toolbar-actions"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.actions.title")}
    >
      <ConfigItem
        id="selection-toolbar-translate"
        title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.actions.translate.title")}
        description={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.actions.translate.description",
        )}
      >
        <Switch
          checked={features.translate.enabled}
          onCheckedChange={(checked) => setFeatureEnabled("translate", checked)}
        />
      </ConfigItem>
      <ConfigItem
        id="selection-toolbar-speak"
        title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.actions.speak.title")}
        description={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.actions.speak.description",
        )}
      >
        <Switch
          checked={features.speak.enabled}
          onCheckedChange={(checked) => setFeatureEnabled("speak", checked)}
        />
      </ConfigItem>
      <SaveSuggestionItems />
    </ConfigSection>
  )
}
