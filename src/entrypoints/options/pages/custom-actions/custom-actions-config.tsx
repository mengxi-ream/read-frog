import { i18n } from "#imports"
import { Badge } from "@/components/ui/base-ui/badge"
import { ConfigCard } from "../../components/config-card"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { CustomActionConfigForm } from "./action-config-form"
import { CustomActionCardList } from "./components/action-card-list"

export function CustomActionsConfig() {
  return (
    <ConfigCard
      id="custom-actions"
      title={(
        <span className="inline-flex items-center gap-2">
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.title")}
          <Badge variant="secondary" className="text-xs font-medium">Public Beta</Badge>
        </span>
      )}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.description")}
      className="lg:flex-col"
    >
      <EntityEditorLayout list={<CustomActionCardList />} editor={<CustomActionConfigForm />} />
    </ConfigCard>
  )
}
