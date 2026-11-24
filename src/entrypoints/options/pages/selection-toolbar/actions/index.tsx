import { FeatureSwitch } from "@/components/feature-switch"
import { getFeatureTitle } from "@/utils/feature-text"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { NestedFeatureItems } from "../../../components/nested-feature-items"
import { ShortcutLink } from "../../../components/shortcut-link"
import { NoteSuggestionItems } from "./note-suggestion-items"

/**
 * What the toolbar can do with a selection: the two built-in buttons, and under translate, the
 * save prompt that follows a translation. The rows are simple mode's switches for them.
 */
export function ActionsSection() {
  return (
    <ConfigSection
      id="selection-toolbar-actions"
      title={i18n.t("options.selectionToolbar.actions.title")}
    >
      <ConfigItem
        id="selection-toolbar-translate"
        title={getFeatureTitle("selectionToolbar.translate")}
        description={
          <>
            {i18n.t("options.selectionToolbar.actions.translate.description")}
            <ShortcutLink sectionId="selection-translation-shortcut" />
          </>
        }
      >
        <FeatureSwitch id="selectionToolbar.translate" />
      </ConfigItem>
      <NestedFeatureItems feature="selectionToolbar.translate">
        <NoteSuggestionItems />
      </NestedFeatureItems>
      <ConfigItem
        id="selection-toolbar-speak"
        title={getFeatureTitle("selectionToolbar.speak")}
        description={
          <>
            {i18n.t("options.selectionToolbar.actions.speak.description")}
            <ShortcutLink sectionId="selection-speak-shortcut" />
          </>
        }
      >
        <FeatureSwitch id="selectionToolbar.speak" />
      </ConfigItem>
    </ConfigSection>
  )
}
