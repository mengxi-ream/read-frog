import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { CustomActionConfigForm } from "./action-config-form"
import { CustomActionCardList } from "./components/action-card-list"

export function CustomActionsConfig() {
  return (
    <ConfigItem
      id="custom-actions"
      orientation="vertical"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.configTitle")}
      description={i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.customActions.description",
      )}
    >
      <EntityEditorLayout list={<CustomActionCardList />} editor={<CustomActionConfigForm />} />
    </ConfigItem>
  )
}
